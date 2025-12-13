// src/hooks/useExtendedForecast.js
import { useState, useEffect, useRef } from "react";

/**
 * useExtendedForecast - fetches a 14-day forecast using NWS (preferred) or Open-Meteo fallback
 * Returns { forecast, loading, error, dataSource }
 * 
 * Strategy:
 * 1. Try NWS hourly forecast (7 days) + daily forecast (extends to 14 days)
 * 2. Fallback to Open-Meteo 15-day forecast if NWS unavailable
 */
export default function useExtendedForecast(lat, lon, options = {}) {
  const { enabled = true } = options;
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const abortRef = useRef(null);

  // Open-Meteo fallback for 15-day forecast
  const fetchOpenMeteoFallback = async (latitude, longitude, controller) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m&temperature_unit=fahrenheit&timeformat=unixtime&forecast_days=15&timezone=auto`;

    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error("Weather data not available");

    const json = await resp.json();
    const temps = json.hourly?.temperature_2m || [];
    const humidity = json.hourly?.relativehumidity_2m || [];

    const processed = json.hourly.time.map((t, i) => ({
      time: new Date(t * 1000),
      temp: temps[i],
      humidity: humidity[i] ?? 50,
    }));

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
      // Step 1: Get NWS grid point
      const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
      const pointsResp = await fetch(pointsUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EngineeringTools/1.0",
          Accept: "application/json",
        },
      });

      if (!pointsResp.ok) {
        return await fetchOpenMeteoFallback(latitude, longitude, controller);
      }

      const pointsData = await pointsResp.json();
      const gridId = pointsData.properties?.gridId;
      const gridX = pointsData.properties?.gridX;
      const gridY = pointsData.properties?.gridY;

      if (!gridId || gridX === undefined || gridY === undefined) {
        throw new Error("Invalid grid point data from NWS");
      }

      // Step 2: Get hourly forecast (7 days)
      const hourlyUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`;
      const hourlyResp = await fetch(hourlyUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EngineeringTools/1.0",
          Accept: "application/json",
        },
      });

      if (!hourlyResp.ok) {
        return await fetchOpenMeteoFallback(latitude, longitude, controller);
      }

      const hourlyData = await hourlyResp.json();
      const hourlyPeriods = hourlyData.properties?.periods || [];
      const hourlyForecast = hourlyPeriods
        .filter((p) => p.startTime && p.temperature !== null)
        .map((p) => ({
          time: new Date(p.startTime),
          temp: p.temperature,
          humidity: p.relativeHumidity?.value ?? 50,
        }))
        .slice(0, 168); // 7 days

      // Step 3: Get daily forecast to extend to 14 days
      const dailyUrl = `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast`;
      const dailyResp = await fetch(dailyUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "EngineeringTools/1.0",
          Accept: "application/json",
        },
      });

      let extendedForecast = hourlyForecast;

      if (dailyResp.ok) {
        const dailyData = await dailyResp.json();
        const dailyPeriods = dailyData.properties?.periods || [];
        
        // Find the last hour from hourly forecast
        const lastHourlyTime = hourlyForecast[hourlyForecast.length - 1]?.time;
        if (lastHourlyTime) {
          // Get daily periods that extend beyond hourly forecast
          const extendedPeriods = dailyPeriods.filter((p) => {
            const periodTime = new Date(p.startTime);
            return periodTime > lastHourlyTime;
          });

          // Convert daily periods to hourly estimates (interpolate between min/max)
          extendedPeriods.forEach((period) => {
            const periodStart = new Date(period.startTime);
            const periodEnd = period.endTime ? new Date(period.endTime) : new Date(periodStart.getTime() + 12 * 60 * 60 * 1000);
            const isNight = period.isDaytime === false;
            
            // Use min temp for night, max for day, or average if not specified
            let temp = period.temperature;
            if (period.temperatureTrend && period.temperatureTrend.includes("falling")) {
              // Night period - use lower temp
              temp = period.temperature - 5; // Estimate lower night temp
            }

            // Create hourly estimates for this period (typically 12 hours)
            const hoursInPeriod = Math.round((periodEnd - periodStart) / (60 * 60 * 1000));
            for (let h = 0; h < hoursInPeriod && extendedForecast.length < 336; h++) {
              const hourTime = new Date(periodStart.getTime() + h * 60 * 60 * 1000);
              extendedForecast.push({
                time: hourTime,
                temp: temp + (isNight ? -2 : 0), // Slight variation
                humidity: period.relativeHumidity?.value ?? 50,
              });
            }
          });
        }
      }

      // Limit to 14 days (336 hours)
      extendedForecast = extendedForecast.slice(0, 336);
      setForecast(extendedForecast);
      setDataSource("NWS");
    } catch (err) {
      if (err.name === "AbortError") return;
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

  return { forecast, loading, error, dataSource };
}

