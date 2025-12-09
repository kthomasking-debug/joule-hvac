import { useState, useEffect, useCallback } from "react";
import {
  getRelayStatus,
  controlRelay,
  updateSystemState,
  evaluateInterlock,
  BridgeConnectionError,
} from "../lib/jouleBridgeApi";

/**
 * React hook for ProStat Bridge relay control (dehumidifier)
 *
 * @param {number} channel - Relay channel (default: 2 for Y2 terminal)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 5000)
 * @returns {Object} Relay state and control functions
 */
export function useProstatRelay(channel = 2, pollInterval = 5000) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [relayOn, setRelayOn] = useState(false);
  const [systemState, setSystemState] = useState(null);

  // Fetch relay status
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getRelayStatus();

      setRelayOn(data.on || false);
      setConnected(data.connected || false);
      setSystemState(data.system_state || null);
      setLoading(false);
      return data;
    } catch (err) {
      // Only log non-connection errors (connection refused is expected when Bridge isn't available)
      if (!(err instanceof BridgeConnectionError)) {
        console.error("Error fetching relay status:", err);
      }
      setError(err.message);
      setConnected(false);
      setLoading(false);
      return null;
    }
  }, []);

  // Start polling
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  // Control functions
  const turnOn = useCallback(async () => {
    try {
      setError(null);
      await controlRelay(channel, true);
      await fetchStatus();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [channel, fetchStatus]);

  const turnOff = useCallback(async () => {
    try {
      setError(null);
      await controlRelay(channel, false);
      await fetchStatus();
      return { success: true };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [channel, fetchStatus]);

  const toggle = useCallback(async () => {
    return relayOn ? await turnOff() : await turnOn();
  }, [relayOn, turnOn, turnOff]);

  // Update system state for interlock logic
  const updateState = useCallback(async (state) => {
    try {
      setError(null);
      const result = await updateSystemState(state);
      setSystemState(result.system_state || null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Evaluate interlock logic
  const evaluate = useCallback(async () => {
    try {
      setError(null);
      const result = await evaluateInterlock();
      await fetchStatus(); // Refresh status after evaluation
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [fetchStatus]);

  return {
    // State
    loading,
    error,
    connected,
    relayOn,
    systemState,

    // Control functions
    turnOn,
    turnOff,
    toggle,
    updateState,
    evaluate,
    refresh: fetchStatus,
  };
}
