import { useState, useEffect } from "react";

/**
 * Hook to fetch temperature from CPU or Ecobee thermostat
 * @param {string} source - 'cpu' or 'ecobee'
 * @param {number} intervalMs - Polling interval in milliseconds (default: 2000)
 * @returns {Object} { temperature, loading, error, isConnected, source, setSource }
 */
export function useTemperature(initialSource = "cpu", intervalMs = 2000) {
  const [temperature, setTemperature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [source, setSource] = useState(initialSource);

  useEffect(() => {
    const fetchTemperature = async () => {
      try {
        const endpoint =
          source === "ecobee"
            ? "http://localhost:3001/api/temperature/ecobee"
            : "http://localhost:3001/api/temperature/cpu";

        const response = await fetch(endpoint);

        if (!response.ok) {
          if (source === "ecobee" && response.status === 404) {
            throw new Error(
              "Ecobee data not available - check IFTTT connection"
            );
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setTemperature(data);
        setIsConnected(true);
        setError(null);
        setLoading(false);
      } catch (err) {
        // Only log non-connection errors to reduce console noise
        // Connection refused is expected when temperature server isn't running
        if (
          !err.message.includes("Failed to fetch") &&
          !err.message.includes("ERR_CONNECTION_REFUSED")
        ) {
          console.error(`Error fetching ${source} temperature:`, err);
        }
        setError(err.message);
        setIsConnected(false);
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchTemperature();

    // Then update at specified interval
    const interval = setInterval(fetchTemperature, intervalMs);

    return () => clearInterval(interval);
  }, [source, intervalMs]);

  return { temperature, loading, error, isConnected, source, setSource };
}

/**
 * Convert Celsius to Fahrenheit
 * @param {number} celsius - Temperature in Celsius
 * @returns {number} Temperature in Fahrenheit
 */
export function celsiusToFahrenheit(celsius) {
  if (celsius === null || celsius === undefined) return null;
  return (celsius * 9) / 5 + 32;
}
