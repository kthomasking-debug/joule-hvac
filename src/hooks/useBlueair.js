import { useState, useEffect, useCallback } from "react";
import {
  getBlueairStatus,
  controlBlueairFan,
  controlBlueairLED,
  startDustKickerCycle,
  BridgeConnectionError,
} from "../lib/jouleBridgeApi";

/**
 * React hook for Blueair air purifier control
 *
 * @param {number} deviceIndex - Device index (default: 0)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 10000)
 * @returns {Object} Blueair state and control functions
 */
export function useBlueair(deviceIndex = 0, pollInterval = 10000) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [fanSpeed, setFanSpeed] = useState(0);
  const [ledBrightness, setLedBrightness] = useState(100);
  const [devicesCount, setDevicesCount] = useState(0);

  // Fetch Blueair status
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getBlueairStatus(deviceIndex);

      if (data && data.status) {
        setFanSpeed(data.status.fan_speed || 0);
        setLedBrightness(data.status.led_brightness || 100);
        setDevicesCount(data.devices_count || 0);
        setConnected(data.connected || false);
        setLoading(false);
        return data;
      }

      setConnected(false);
      setLoading(false);
      return null;
    } catch (err) {
      // Handle 404s gracefully (Blueair not configured or not available)
      if (err.message && (err.message.includes('404') || err.message.includes('Device not found'))) {
        // Blueair not available - this is fine, just mark as not connected
        setConnected(false);
        setLoading(false);
        setError(null); // Don't show error for missing device
        return null;
      }
      // Only log non-connection errors (connection refused is expected when Bridge isn't available)
      if (!(err instanceof BridgeConnectionError)) {
        console.debug("Error fetching Blueair status:", err); // Changed to debug to reduce noise
      }
      setError(err.message);
      setConnected(false);
      setLoading(false);
      return null;
    }
  }, [deviceIndex]);

  // Start polling
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  // Control functions
  const setFan = useCallback(
    async (speed) => {
      if (speed < 0 || speed > 3) {
        throw new Error("Fan speed must be 0-3");
      }

      try {
        setError(null);
        await controlBlueairFan(deviceIndex, speed);
        await fetchStatus();
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [deviceIndex, fetchStatus]
  );

  const setLED = useCallback(
    async (brightness) => {
      if (brightness < 0 || brightness > 100) {
        throw new Error("LED brightness must be 0-100");
      }

      try {
        setError(null);
        await controlBlueairLED(deviceIndex, brightness);
        await fetchStatus();
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [deviceIndex, fetchStatus]
  );

  const startDustKicker = useCallback(async () => {
    try {
      setError(null);
      await startDustKickerCycle();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Convenience functions
  const setOff = useCallback(() => setFan(0), [setFan]);
  const setLow = useCallback(() => setFan(1), [setFan]);
  const setMedium = useCallback(() => setFan(2), [setFan]);
  const setMax = useCallback(() => setFan(3), [setFan]);
  const setLEDOff = useCallback(() => setLED(0), [setLED]);
  const setLEDOn = useCallback(() => setLED(100), [setLED]);

  return {
    // State
    loading,
    error,
    connected,
    fanSpeed,
    ledBrightness,
    devicesCount,

    // Control functions
    setFan,
    setLED,
    setOff,
    setLow,
    setMedium,
    setMax,
    setLEDOff,
    setLEDOn,
    startDustKicker,
    refresh: fetchStatus,
  };
}
