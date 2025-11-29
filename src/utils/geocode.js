// Geocoding utilities for forward and reverse lookups using Open-Meteo APIs
// Shapes we return:
// Forward candidate: { name, admin1, admin2, country, latitude, longitude, population }
// Reverse result: same shape for the best match

export async function fetchGeocodeCandidates(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=10&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch location data.");
  const data = await res.json();
  const results = (data?.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || "",
    admin2: r.admin2 || "",
    country: r.country || "",
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation || 0,
    population: r.population || 0,
  }));
  return results;
}

export function chooseBestCandidate(candidates) {
  if (!candidates || candidates.length === 0) return null;
  // Prefer higher population when available; otherwise the first item from API (already relevance-sorted)
  const withPop = candidates.filter((c) => typeof c.population === "number");
  if (withPop.length > 0) {
    return withPop.sort((a, b) => (b.population || 0) - (a.population || 0))[0];
  }
  return candidates[0];
}

export async function reverseGeocode(latitude, longitude) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const r = (data?.results || [])[0];
  if (!r) return null;
  return {
    name: r.name,
    admin1: r.admin1 || "",
    admin2: r.admin2 || "",
    country: r.country || "",
    latitude: r.latitude,
    longitude: r.longitude,
    elevation: r.elevation || 0,
    population: r.population || 0,
  };
}
