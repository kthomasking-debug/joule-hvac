// src/hooks/useHistoricalHourly.js
import { useState, useEffect, useRef } from "react";

/**
 * useHistoricalHourly - fetches hourly historical temperature data from Open-Meteo archive
 * Returns { hourlyData, loading, error }
 * 
 * Fetches hourly temperatures for the past year to calculate aux heat hour-by-hour
 */
export default function useHistoricalHourly(lat, lon, options = {}) {
  const { enabled = true, year = null } = options;
  const [hourlyData, setHourlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = async (latitude, longitude, targetYear) => {
    if (!latitude || !longitude) return;
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        /* noop */
      }
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      // Use target year or previous year (most recent complete year)
      const useYear = targetYear || new Date().getFullYear() - 1;
      const startDate = `${useYear}-01-01`;
      const endDate = `${useYear}-12-31`;

      // Open-Meteo archive API for hourly historical data
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relativehumidity_2m&temperature_unit=fahrenheit&timezone=auto&timeformat=unixtime`;

      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("🌤️ Fetching historical hourly data:", {
          latitude,
          longitude,
          year: useYear,
          url,
        });
      }

      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) {
        throw new Error(`Historical data not available: ${resp.status}`);
      }

      const json = await resp.json();
      const temps = json.hourly?.temperature_2m || [];
      const humidity = json.hourly?.relativehumidity_2m || [];
      const times = json.hourly?.time || [];

      const processed = times.map((t, i) => ({
        time: new Date(t * 1000),
        temp: temps[i],
        humidity: humidity[i] ?? 50,
        year: useYear,
      }));

      setHourlyData(processed);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Unknown error fetching historical data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchData(lat, lon, year);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [lat, lon, enabled, year]);

  return { hourlyData, loading, error };
}

