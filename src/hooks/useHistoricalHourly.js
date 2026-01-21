// src/hooks/useHistoricalHourly.js
import { useState, useEffect, useRef } from "react";

/**
 * Cache helpers for historical hourly data
 */
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (historical data doesn't change)

function getCachedHistoricalHourly(lat, lon, year) {
  try {
    const cacheKey = `historical_hourly_${lat.toFixed(2)}_${lon.toFixed(2)}_${year}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < CACHE_DURATION) {
      console.log(`📦 Using cached historical hourly data (${Math.round(age / 1000 / 60)}min old)`);
      return data;
    }
    
    // Cache expired, remove it
    sessionStorage.removeItem(cacheKey);
    return null;
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

function setCachedHistoricalHourly(lat, lon, year, data) {
  try {
    const cacheKey = `historical_hourly_${lat.toFixed(2)}_${lon.toFixed(2)}_${year}`;
    // Store processed data (not raw API response) to save space
    sessionStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('Cache write error:', err);
    // If storage is full, try to clear old entries
    try {
      const keys = Object.keys(sessionStorage);
      const historicalKeys = keys.filter(k => k.startsWith('historical_hourly_'));
      if (historicalKeys.length > 5) {
        // Remove oldest entries
        const entries = historicalKeys.map(k => ({
          key: k,
          timestamp: JSON.parse(sessionStorage.getItem(k) || '{}').timestamp || 0
        })).sort((a, b) => a.timestamp - b.timestamp);
        entries.slice(0, entries.length - 5).forEach(e => sessionStorage.removeItem(e.key));
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * useHistoricalHourly - fetches hourly historical temperature data from Open-Meteo archive
 * Returns { hourlyData, loading, error }
 * 
 * Fetches hourly temperatures for the past year to calculate aux heat hour-by-hour
 */
export default function useHistoricalHourly(lat, lon, options = {}) {
  const { enabled = true, year = null } = options;
  
  // Initialize state from cache synchronously if available
  const useYear = year || new Date().getFullYear() - 1;
  const initialCache = (() => {
    if (!enabled || !lat || !lon) return null;
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
    return getCachedHistoricalHourly(latNum, lonNum, useYear);
  })();
  
  const [hourlyData, setHourlyData] = useState(initialCache);
  const [loading, setLoading] = useState(!initialCache && enabled); // Only loading if no cache
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = async (latitude, longitude, targetYear) => {
    if (!latitude || !longitude) return;

    // Validate coordinates are valid numbers
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn("Invalid coordinates for historical hourly data:", {
        latitude,
        longitude,
      });
      return;
    }

    // Use target year or previous year (most recent complete year)
    const useYear = targetYear || new Date().getFullYear() - 1;

    // Check cache first (skip if we already loaded from cache in initial state)
    const cached = getCachedHistoricalHourly(lat, lon, useYear);
    if (cached) {
      setHourlyData(cached);
      setLoading(false);
      setError(null);
      return;
    }

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
      setCachedHistoricalHourly(lat, lon, useYear, processed);
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

