// src/hooks/useMonthlyForecast.js
import { useState, useEffect, useRef } from "react";

/**
 * useMonthlyForecast - fetches a 15-day forecast and fills remaining days with historical averages
 * Returns { dailyForecast, loading, error, refetch }
 *
 * Strategy:
 * 1. Fetch 15-day forecast from Open-Meteo (supports up to 16 days)
 * 2. For days not covered by forecast, use historical averages from Open-Meteo archive API
 */
export default function useMonthlyForecast(lat, lon, month, options = {}) {
  const { enabled = true } = options;
  const [dailyForecast, setDailyForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetchData = async (latitude, longitude, targetMonth) => {
    if (!latitude || !longitude || !targetMonth) return;

    // Validate coordinates are valid numbers
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn("Invalid coordinates for forecast:", {
        latitude,
        longitude,
      });
      return;
    }

    // Validate latitude is between -90 and 90, longitude between -180 and 180
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.warn("Coordinates out of valid range:", { lat, lon });
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
      // Step 1: Fetch 15-day forecast from Open-Meteo
      // Request both daily temps AND hourly humidity (can get both in one call)
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&hourly=relativehumidity_2m&temperature_unit=fahrenheit&timezone=auto&forecast_days=15`;

      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("🌤️ Fetching 15-day forecast:", {
          latitude,
          longitude,
          url: forecastUrl,
        });
      }

      const forecastResp = await fetch(forecastUrl, {
        signal: controller.signal,
      });

      if (!forecastResp.ok) {
        // Try to get more details from the error response
        let errorDetails = `Forecast API error: ${forecastResp.status}`;
        try {
          const errorText = await forecastResp.text();
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.reason) {
              errorDetails += ` - ${errorData.reason}`;
            }
          } catch {
            errorDetails += ` - ${errorText.substring(0, 100)}`;
          }
        } catch {
          // Ignore parse errors
        }
        throw new Error(errorDetails);
      }

      const forecastData = await forecastResp.json();

      // Helper function to aggregate hourly humidity into daily values
      const buildDailyHumidity = (hourlyTime, hourlyHumidity, dailyDates) => {
        return dailyDates.map((day) => {
          // Match all hourly timestamps that start with "YYYY-MM-DD"
          const dayValues = [];
          for (let i = 0; i < hourlyTime.length; i++) {
            if (hourlyTime[i].startsWith(day)) {
              const humidity = hourlyHumidity[i];
              if (
                humidity !== null &&
                humidity !== undefined &&
                Number.isFinite(humidity)
              ) {
                dayValues.push(humidity);
              }
            }
          }

          if (dayValues.length === 0) {
            // Fallback if something weird happens
            return {
              date: day,
              humidityMin: 60,
              humidityMax: 60,
              humidityAvg: 60,
            };
          }

          const sum = dayValues.reduce((a, b) => a + b, 0);
          const humidityAvg = sum / dayValues.length;
          const humidityMin = Math.min(...dayValues);
          const humidityMax = Math.max(...dayValues);

          return {
            date: day,
            humidityMin,
            humidityMax,
            humidityAvg,
          };
        });
      };

      // Aggregate hourly humidity into daily values
      const dailyHumidity = buildDailyHumidity(
        forecastData.hourly?.time || [],
        forecastData.hourly?.relativehumidity_2m || [],
        forecastData.daily?.time || []
      );

      // Process forecast days - filter to only include days in the target month
      const today = new Date();
      const year = today.getFullYear();
      const daysInMonth = new Date(year, targetMonth, 0).getDate();

      const forecastDays = (forecastData.daily?.time || [])
        .map((date, idx) => {
          const humidity = dailyHumidity.find((h) => h.date === date);
          return {
            date: new Date(date),
            dayOfMonth: new Date(date).getDate(),
            high: forecastData.daily.temperature_2m_max[idx],
            low: forecastData.daily.temperature_2m_min[idx],
            avg:
              (forecastData.daily.temperature_2m_max[idx] +
                forecastData.daily.temperature_2m_min[idx]) /
              2,
            humidity: humidity?.humidityAvg ?? 60, // Use aggregated average humidity
            source: "forecast",
          };
        })
        .filter((day) => {
          const dayDate = day.date;
          return (
            dayDate.getMonth() === targetMonth - 1 &&
            dayDate.getFullYear() === year
          );
        });

      // Create a map of forecast days by day of month
      const forecastMap = new Map();
      forecastDays.forEach((day) => {
        forecastMap.set(day.dayOfMonth, day);
      });

      // Step 2: Fetch historical averages for the entire month
      const currentYear = today.getFullYear();
      const startYear = currentYear - 10;
      const endYear = currentYear - 1;

      // Fetch historical data for the entire month across multiple years
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startYear}-${String(
        targetMonth
      ).padStart(2, "0")}-01&end_date=${endYear}-${String(targetMonth).padStart(
        2,
        "0"
      )}-${String(daysInMonth).padStart(
        2,
        "0"
      )}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit`;

      if (typeof window !== "undefined" && import.meta?.env?.DEV) {
        console.log("📊 Fetching historical averages for missing days:", {
          url: archiveUrl,
        });
      }

      try {
        const archiveResp = await fetch(archiveUrl, {
          signal: controller.signal,
        });

        if (archiveResp.ok) {
          const archiveData = await archiveResp.json();

          // Build complete month: use forecast where available, historical for the rest
          const completeMonth = [];
          for (let day = 1; day <= daysInMonth; day++) {
            if (forecastMap.has(day)) {
              // Use forecast data
              const forecastDay = forecastMap.get(day);
              completeMonth.push({
                date: new Date(currentYear, targetMonth - 1, day),
                high: forecastDay.high,
                low: forecastDay.low,
                avg: forecastDay.avg,
                humidity: forecastDay.humidity,
                source: "forecast",
              });
            } else {
              // Use historical average
              const tempsForThisDay = [];

              // Extract temperatures for this day across all years
              archiveData.daily.time.forEach((dateStr, idx) => {
                const date = new Date(dateStr);
                // Check if this date matches the day of month we're looking for
                if (
                  date.getDate() === day &&
                  date.getMonth() === targetMonth - 1
                ) {
                  const high = archiveData.daily.temperature_2m_max[idx];
                  const low = archiveData.daily.temperature_2m_min[idx];
                  if (Number.isFinite(high) && Number.isFinite(low)) {
                    tempsForThisDay.push({ high, low });
                  }
                }
              });

              if (tempsForThisDay.length > 0) {
                const avgHigh =
                  tempsForThisDay.reduce((sum, t) => sum + t.high, 0) /
                  tempsForThisDay.length;
                const avgLow =
                  tempsForThisDay.reduce((sum, t) => sum + t.low, 0) /
                  tempsForThisDay.length;

                completeMonth.push({
                  date: new Date(currentYear, targetMonth - 1, day),
                  high: avgHigh,
                  low: avgLow,
                  avg: (avgHigh + avgLow) / 2,
                  humidity: 60, // Default humidity for historical data
                  source: "historical",
                });
              } else {
                // Fallback: use average of forecast days if no historical data
                const avgForecastHigh =
                  forecastDays.length > 0
                    ? forecastDays.reduce((sum, d) => sum + d.high, 0) /
                      forecastDays.length
                    : 50;
                const avgForecastLow =
                  forecastDays.length > 0
                    ? forecastDays.reduce((sum, d) => sum + d.low, 0) /
                      forecastDays.length
                    : 40;
                completeMonth.push({
                  date: new Date(currentYear, targetMonth - 1, day),
                  high: avgForecastHigh,
                  low: avgForecastLow,
                  avg: (avgForecastHigh + avgForecastLow) / 2,
                  humidity: 60,
                  source: "historical",
                });
              }
            }
          }

          setDailyForecast(completeMonth);
        } else {
          // If archive fails, use forecast for available days and average for the rest
          console.warn(
            "Historical archive API failed, using forecast average for missing days"
          );
          const avgForecastHigh =
            forecastDays.length > 0
              ? forecastDays.reduce((sum, d) => sum + d.high, 0) /
                forecastDays.length
              : 50;
          const avgForecastLow =
            forecastDays.length > 0
              ? forecastDays.reduce((sum, d) => sum + d.low, 0) /
                forecastDays.length
              : 40;
          const avgForecastAvg = (avgForecastHigh + avgForecastLow) / 2;

          const completeMonth = [];
          for (let day = 1; day <= daysInMonth; day++) {
            if (forecastMap.has(day)) {
              const forecastDay = forecastMap.get(day);
              completeMonth.push({
                date: new Date(currentYear, targetMonth - 1, day),
                high: forecastDay.high,
                low: forecastDay.low,
                avg: forecastDay.avg,
                humidity: forecastDay.humidity,
                source: "forecast",
              });
            } else {
              completeMonth.push({
                date: new Date(currentYear, targetMonth - 1, day),
                high: avgForecastHigh,
                low: avgForecastLow,
                avg: avgForecastAvg,
                humidity: 60,
                source: "historical",
              });
            }
          }
          setDailyForecast(completeMonth);
        }
      } catch (archiveErr) {
        // If archive fetch fails, use forecast data only
        console.warn("Historical archive fetch failed:", archiveErr);
        const fallbackMonth = [];
        const avgForecastHigh =
          forecastDays.length > 0
            ? forecastDays.reduce((sum, d) => sum + d.high, 0) /
              forecastDays.length
            : 50;
        const avgForecastLow =
          forecastDays.length > 0
            ? forecastDays.reduce((sum, d) => sum + d.low, 0) /
              forecastDays.length
            : 40;

        for (let day = 1; day <= daysInMonth; day++) {
          if (forecastMap.has(day)) {
            const forecastDay = forecastMap.get(day);
            fallbackMonth.push({
              date: new Date(currentYear, targetMonth - 1, day),
              high: forecastDay.high,
              low: forecastDay.low,
              avg: forecastDay.avg,
              humidity: forecastDay.humidity,
              source: "forecast",
            });
          } else {
            fallbackMonth.push({
              date: new Date(currentYear, targetMonth - 1, day),
              high: avgForecastHigh,
              low: avgForecastLow,
              avg: (avgForecastHigh + avgForecastLow) / 2,
              humidity: 60,
              source: "historical",
            });
          }
        }
        setDailyForecast(fallbackMonth);
      }
    } catch (err) {
      if (err.name === "AbortError") return; // canceled

      console.error("Error fetching monthly forecast:", err);
      setError(err.message || "Unknown error fetching forecast");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchData(lat, lon, month);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [lat, lon, month, enabled]);

  const refetch = () => fetchData(lat, lon, month);

  return { dailyForecast, loading, error, refetch };
}
