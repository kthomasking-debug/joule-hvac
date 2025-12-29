import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getThermostatStatus,
  setTemperature as bridgeSetTemperature,
  setMode as bridgeSetMode,
  getPrimaryDeviceId,
  checkBridgeHealth,
  BridgeConnectionError,
} from "../lib/jouleBridgeApi";
import { cToF } from "../lib/units";

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
      if (!available) {
        // Check if URL is configured - if not, set a helpful error
        const url = localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL;
        if (!url || url.trim() === '') {
          setError('Joule Bridge URL not configured. Please set it in Settings.');
        } else {
          setError('Joule Bridge is not responding. Make sure it is running.');
        }
      } else {
        setError(null); // Clear error if bridge is available
      }
      return available;
    } catch (err) {
      setBridgeAvailable(false);
      setError(err.message || 'Joule Bridge is not available');
      return false;
    }
  }, []);

  // Fetch thermostat data
  const fetchThermostatData = useCallback(async () => {
    let deviceIdToUse = activeDeviceId;
    
    if (!deviceIdToUse) {
      try {
        const id = await getPrimaryDeviceId();
        console.debug("[JouleBridge] Fetched primary device ID:", id);
        if (id) {
          deviceIdToUse = id;
          setPrimaryId(id);
        }
      } catch (e) {
        console.debug("[JouleBridge] Could not get primary device ID:", e);
      }
    }
    
    if (!deviceIdToUse) {
      console.debug("[JouleBridge] No device ID available");
      setError("No device paired. Please pair a device first.");
      setConnected(false);
      setLoading(false);
      return null;
    }

    try {
      setError(null);
      console.debug("[JouleBridge] Fetching status for device:", deviceIdToUse);
      const data = await getThermostatStatus(deviceIdToUse);
      console.debug("[JouleBridge] Got status data:", data);

      if (data) {
        // Convert temperatures from Celsius to Fahrenheit (HomeKit returns Celsius)
        const tempF = data.temperature != null ? cToF(data.temperature) : null;
        const targetTempF = data.target_temperature != null ? cToF(data.target_temperature) : null;
        
        const normalized = {
          identifier: data.device_id,
          name: data.name || "Ecobee Thermostat",
          temperature: tempF,
          humidity: data.humidity || null,
          targetHeatTemp: data.mode === "heat" ? targetTempF : null,
          targetCoolTemp: data.mode === "cool" ? targetTempF : null,
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

        console.debug("[JouleBridge] ✓ Connected! Normalized data:", normalized);
        setThermostatData(normalized);
        setConnected(true);
        setBridgeAvailable(true); // Ensure bridge is marked as available when we get data
        setLoading(false);
        return normalized;
      }

      console.debug("[JouleBridge] No data returned from getThermostatStatus");
      setConnected(false);
      setLoading(false);
      return null;
    } catch (err) {
      console.error("[JouleBridge] Error fetching data:", err.message || err);
      
      if (!(err instanceof BridgeConnectionError)) {
        console.error("[JouleBridge] Full error:", err);
      }
      
      // Check if device is paired but not reachable
      const errorMsg = err.message || "";
      if (errorMsg.includes("Connect call failed") || errorMsg.includes("not reachable") || errorMsg.includes("ConnectionError") || errorMsg.includes("Errno 111")) {
        // Device is paired but not reachable (IP may have changed)
        // The bridge will automatically refresh IP and retry, but we should keep trying
        // Use a friendly message - the DeviceOfflineGuide component will show detailed help
        console.debug("[JouleBridge] Device offline - will retry");
        setError("Device offline - reconnecting automatically. See Settings for help if needed.");
        // Don't set connected to false immediately - keep trying in the background
        // The polling will continue and eventually reconnect
      } else {
        setError(err.message);
      }
      
      setConnected(false);
      setLoading(false);
      // Keep polling even if connection failed - it might recover
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
      // Try to get device ID if not available
      let deviceIdToUse = activeDeviceId;
      if (!deviceIdToUse) {
        try {
          deviceIdToUse = await getPrimaryDeviceId();
          if (deviceIdToUse) {
            setPrimaryId(deviceIdToUse);
          }
        } catch (e) {
          console.debug("Could not get primary device ID:", e);
        }
      }

      if (!deviceIdToUse) {
        const error = new Error("No device paired. Please pair a device in Settings → ProStat Bridge.");
        setError(error.message);
        throw error;
      }

      try {
        setError(null);
        const temp = thermostatData?.mode === "cool" ? coolTemp : heatTemp;
        await bridgeSetTemperature(deviceIdToUse, temp);
        await fetchThermostatData();
        return { success: true };
      } catch (err) {
        const errorMsg = err.message || "Failed to set temperature";
        setError(errorMsg);
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

