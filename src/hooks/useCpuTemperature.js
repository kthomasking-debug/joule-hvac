import { useState, useEffect } from "react";

/**
 * Hook to fetch CPU temperature from local temperature server
 * Temperature is divided by 2 for thermostat bench testing
 * @param {number} intervalMs - Polling interval in milliseconds (default: 2000)
 * @returns {Object} { temperature, loading, error, isConnected }
 */
export function useCpuTemperature(intervalMs = 2000) {
  const [temperature, setTemperature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchTemperature = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/temperature");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setTemperature(data);
        setIsConnected(true);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching CPU temperature:", err);
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
  }, [intervalMs]);

  return { temperature, loading, error, isConnected };
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
