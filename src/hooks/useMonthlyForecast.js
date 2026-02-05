// src/hooks/useMonthlyForecast.js
import { useQuery } from "@tanstack/react-query";

// React Query handles caching automatically - no need for manual cache helpers

/**
 * Fetch function for monthly forecast - extracted for React Query
 * Strategy:
 * 1. Fetch 15-day forecast from Open-Meteo (supports up to 16 days)
 * 2. For days not covered by forecast, use historical averages from Open-Meteo archive API
 */
async function fetchMonthlyForecast({ lat, lon, month, signal }) {
  const latitude = lat;
  const longitude = lon;
  const targetMonth = month;
  if (!latitude || !longitude || !targetMonth) {
    throw new Error('Missing required parameters');
  }

  // Validate coordinates are valid numbers
  const validLat = Number(latitude);
  const validLon = Number(longitude);
  if (!Number.isFinite(validLat) || !Number.isFinite(validLon)) {
    throw new Error(`Invalid coordinates: ${latitude}, ${longitude}`);
  }

  // Validate latitude is between -90 and 90, longitude between -180 and 180
  if (validLat < -90 || validLat > 90 || validLon < -180 || validLon > 180) {
    throw new Error(`Coordinates out of range: ${validLat}, ${validLon}`);
  }

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
      signal,
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
          // Parse YYYY-MM-DD dates as local time (add T12:00 to avoid timezone issues)
          const localDate = new Date(date + 'T12:00:00');
          return {
            date: localDate,
            dayOfMonth: localDate.getDate(),
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
      // Reduced from 10 years to 3 years for faster loading (still statistically significant)
      const currentYear = today.getFullYear();
      const startYear = currentYear - 3;
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
          signal,
        });

        if (archiveResp.ok) {
          const archiveData = await archiveResp.json();

          // Build complete month: use forecast where available, historical for the rest
          const completeMonth = [];
          
          // Create midnight timestamp ONCE, outside the loop (setHours mutates the date object!)
          const todayMidnight = new Date(today);
          todayMidnight.setHours(0, 0, 0, 0);
          const todayTimestamp = todayMidnight.getTime();
          
          for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(currentYear, targetMonth - 1, day);
            const isPastDay = dayDate.getTime() < todayTimestamp;
            
            // Use forecast only if the day has actual forecast data and is not a past day
            // For past days or days beyond forecast range, use historical
            if (forecastMap.has(day) && !isPastDay) {
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
              // Use historical average for past days or days beyond forecast range
              const tempsForThisDay = [];

              // Extract temperatures for this day across all years
              archiveData.daily.time.forEach((dateStr, idx) => {
                // Parse YYYY-MM-DD as local time to avoid timezone issues
                const date = new Date(dateStr + 'T12:00:00');
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

          if (typeof window !== "undefined" && import.meta?.env?.DEV) {
            const forecastCount = completeMonth.filter(d => d.source === 'forecast').length;
            const historicalCount = completeMonth.filter(d => d.source === 'historical').length;
            console.log(`📅 Monthly forecast complete: ${completeMonth.length} days (${forecastCount} forecast, ${historicalCount} historical)`);
          }

          return completeMonth;
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
          return completeMonth;        }
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
        return fallbackMonth;
      }
    } catch (err) {
      console.error("Error fetching monthly forecast:", err);
      throw err;
    }
}

/**
 * React Query hook wrapper for monthly forecast
 * Automatically fetches in background and keeps data fresh
 */
export default function useMonthlyForecast(lat, lon, month, options = {}) {
  const { enabled = true } = options;

  const query = useQuery({
    queryKey: ['monthlyForecast', lat, lon, month],
    queryFn: ({ signal }) => fetchMonthlyForecast({ lat, lon, month, signal }),
    enabled: enabled && !!lat && !!lon && !!month,
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    dailyForecast: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
