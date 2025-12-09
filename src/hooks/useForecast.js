// src/hooks/useForecast.js
import { useState, useEffect, useRef } from "react";

/**
 * useForecast - fetches a 7-day hourly forecast from weather.gov API (NWS) and supports cancellation.
 * Returns { forecast, loading, error, refetch }
 *
 * Uses official NWS weather.gov API for accurate US forecasts:
 * 1. Get grid point for lat/lon: /points/{lat},{lon}
 * 2. Get hourly forecast: /gridpoints/{wfo}/{x},{y}/forecast/hourly
 */
export default function useForecast(lat, lon, options = {}) {
  const { enabled = true } = options;
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null); // Track which API was used
  const abortRef = useRef(null);

  // Fallback to Open-Meteo if NWS is unavailable
  // Defined before fetchData so it can be called from within fetchData
  const fetchOpenMeteoFallback = async (latitude, longitude, controller) => {
    // Request humidity & dew point (some older naming variations included for robustness)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m,relative_humidity_2m,dew_point_2m&temperature_unit=fahrenheit&timeformat=unixtime&forecast_days=7&timezone=auto`;

    if (typeof window !== "undefined" && import.meta?.env?.DEV) {
      console.log("🌤️ Using Open-Meteo Fallback:", {
        latitude,
        longitude,
        url,
      });
    }

    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok)
      throw new Error("Weather data not available for this location.");
    const json = await resp.json();

    // Extract elevation from API response (in meters, convert to feet)
    const apiElevationMeters = json.elevation;
    const apiElevationFeet = apiElevationMeters
      ? Math.round(apiElevationMeters * 3.28084)
      : null;

    const temps = json.hourly?.temperature_2m || [];
    const humidityA = json.hourly?.relativehumidity_2m || [];
    const humidityB = json.hourly?.relative_humidity_2m || [];
    const dewpoints = json.hourly?.dew_point_2m || [];

    const processed = json.hourly.time.map((t, i) => {
      const temp = temps[i];
      let humidity = humidityA[i] ?? humidityB[i];

      // Fallback: derive relative humidity from dewpoint if missing
      if (
        (humidity === undefined || humidity === null) &&
        dewpoints[i] !== undefined &&
        temp !== undefined
      ) {
        // Convert Fahrenheit to Celsius for Magnus formula
        const TdC = ((dewpoints[i] - 32) * 5) / 9;
        const TC = ((temp - 32) * 5) / 9;
        // Approximation using Magnus formula (over water)
        const esTd = Math.exp((17.625 * TdC) / (243.04 + TdC));
        const esT = Math.exp((17.625 * TC) / (243.04 + TC));
        humidity = Math.min(100, Math.max(0, (esTd / esT) * 100));
      }

      // Final fallback to 50% if still missing
      if (humidity === undefined || humidity === null || isNaN(humidity)) {
        humidity = 50;
      }

      return {
        time: new Date(t * 1000),
        temp,
        humidity,
        // Store API elevation for elevation adjustment
        apiElevationFeet: apiElevationFeet,
      };
    });

    setForecast(processed);
    setDataSource("Open-Meteo");
  };

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
      // Step 1: Get grid point for this location
      const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;

      // Debug logging
      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("🌤️ Fetching NWS Grid Point:", {
          latitude,
          longitude,
          url: pointsUrl,
        });
      }

      const pointsResp = await fetch(pointsUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EngineeringTools/1.0 (https://github.com/your-repo)",
          Accept: "application/json",
        },
      });

      if (!pointsResp.ok) {
        // Fallback to Open-Meteo if NWS fails (e.g., outside US)
        if (typeof window !== "undefined" && import.meta?.env?.DEV) {
          console.warn(
            "🌤️ NWS API failed, falling back to Open-Meteo:",
            pointsResp.status
          );
        }
        return await fetchOpenMeteoFallback(latitude, longitude, controller);
      }

      const pointsData = await pointsResp.json();
      const gridId = pointsData.properties?.gridId;
      const gridX = pointsData.properties?.gridX;
      const gridY = pointsData.properties?.gridY;
      const elevationMeters = pointsData.properties?.elevation?.value;
      const elevationFeet = elevationMeters
        ? Math.round(elevationMeters * 3.28084)
        : null;

      if (!gridId || gridX === undefined || gridY === undefined) {
        throw new Error("Invalid grid point data from NWS");
      }

      // Step 2: Get hourly forecast from grid point
      const forecastUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;

      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("🌤️ Fetching NWS Hourly Forecast:", {
          gridId,
          gridX,
          gridY,
          url: forecastUrl,
        });
      }

      const forecastResp = await fetch(forecastUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EngineeringTools/1.0 (https://github.com/your-repo)",
          Accept: "application/json",
        },
      });

      if (!forecastResp.ok) {
        throw new Error(`NWS forecast not available: ${forecastResp.status}`);
      }

      const forecastData = await forecastResp.json();
      const periods = forecastData.properties?.periods || [];

      // Debug logging
      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("🌤️ NWS Forecast Response:", {
          gridId,
          gridX,
          gridY,
          elevation_feet: elevationFeet,
          periodsCount: periods.length,
          firstPeriod: periods[0]
            ? {
                time: periods[0].startTime,
                temp: periods[0].temperature,
                humidity: periods[0].relativeHumidity?.value,
              }
            : null,
        });
      }

      // Process NWS forecast data
      // NWS provides periods (typically 1-hour intervals for hourly forecast)
      const processed = periods
        .filter((period) => period.startTime && period.temperature !== null)
        .map((period) => ({
          time: new Date(period.startTime),
          temp: period.temperature,
          humidity: period.relativeHumidity?.value || null,
          // Store API elevation for elevation adjustment
          apiElevationFeet: elevationFeet,
        }))
        .slice(0, 168); // Limit to 7 days (168 hours)

      setForecast(processed);
      setDataSource("NWS");
    } catch (err) {
      if (err.name === "AbortError") return; // canceled

      // If NWS fails, try Open-Meteo as fallback
      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.warn(
          "🌤️ NWS API error, trying Open-Meteo fallback:",
          err.message
        );
      }
      try {
        await fetchOpenMeteoFallback(latitude, longitude, controller);
      } catch (fallbackErr) {
        setError(fallbackErr.message || "Unknown error fetching forecast");
      }
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

  return { forecast, loading, error, refetch, dataSource };
}
