// Quick test to see what the geocoding API returns
async function testGeocodingAPI() {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?name=Denver&count=1&language=en&format=json";
  const res = await fetch(url);
  const data = await res.json();
  console.log("API Response:", JSON.stringify(data, null, 2));
}

testGeocodingAPI();
