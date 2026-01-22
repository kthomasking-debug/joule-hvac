// src/utils/prefetchForecast.js
/**
 * Utility to prefetch forecast data for React Query
 * Extracts the fetch logic from useMonthlyForecast for direct use in prefetching
 */

export async function prefetchMonthlyForecast({ lat, lon, month, signal }) {
  // Import the fetch function from the hook module
  // This is a bit of a workaround since we're exporting only the hook by default
  // In the future, we could export both the fetch function and the hook separately
  
  const latitude = lat;
  const longitude = lon;
  const targetMonth = month;
  
  if (!latitude || !longitude || !targetMonth) {
    throw new Error('Missing required parameters');
  }

  // Validate coordinates
  const validLat = Number(latitude);
  const validLon = Number(longitude);
  if (!Number.isFinite(validLat) || !Number.isFinite(validLon)) {
    throw new Error(`Invalid coordinates: ${latitude}, ${longitude}`);
  }

  if (validLat < -90 || validLat > 90 || validLon < -180 || validLon > 180) {
    throw new Error(`Coordinates out of range: ${validLat}, ${validLon}`);
  }

  try {
    // Simplified version - just fetch forecast, don't fill historical
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&hourly=relativehumidity_2m&temperature_unit=fahrenheit&timezone=auto&forecast_days=15`;

    const forecastResp = await fetch(forecastUrl, { signal });

    if (!forecastResp.ok) {
      throw new Error(`Forecast API error: ${forecastResp.status}`);
    }

    const forecastData = await forecastResp.json();

    // Quick processing - just return what we have
    const today = new Date();
    const year = today.getFullYear();

    const forecastDays = (forecastData.daily?.time || [])
      .map((date, idx) => ({
        date: new Date(date),
        dayOfMonth: new Date(date).getDate(),
        high: forecastData.daily.temperature_2m_max[idx],
        low: forecastData.daily.temperature_2m_min[idx],
        avg: (forecastData.daily.temperature_2m_max[idx] + forecastData.daily.temperature_2m_min[idx]) / 2,
        humidity: 60,
        source: "forecast",
      }))
      .filter((day) => {
        const dayDate = day.date;
        return dayDate.getMonth() === targetMonth - 1 && dayDate.getFullYear() === year;
      });

    return forecastDays;
  } catch (err) {
    console.error("Prefetch error:", err);
    throw err;
  }
}
