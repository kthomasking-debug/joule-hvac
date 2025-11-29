// src/hooks/useForecast.js
import { useState, useEffect, useRef } from "react";

/**
 * useForecast - fetches a 7-day hourly forecast from Open-Meteo and supports cancellation.
 * Returns { forecast, loading, error, refetch }
 */
export default function useForecast(lat, lon, options = {}) {
  const { enabled = true } = options;
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = async (latitude, longitude) => {
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m&temperature_unit=fahrenheit&timeformat=unixtime&forecast_days=7`;
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok)
        throw new Error("Weather data not available for this location.");
      const json = await resp.json();
      const processed = json.hourly.time.map((t, i) => ({
        time: new Date(t * 1000),
        temp: json.hourly.temperature_2m[i],
        humidity: json.hourly.relativehumidity_2m[i],
      }));
      setForecast(processed);
    } catch (err) {
      if (err.name === "AbortError") return; // canceled
      setError(err.message || "Unknown error fetching forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchData(lat, lon);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [lat, lon, enabled]);

  const refetch = () => fetchData(lat, lon);

  return { forecast, loading, error, refetch };
}
