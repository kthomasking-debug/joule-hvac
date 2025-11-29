const fetchJson = async (url) => {
  const r = await fetch(url);
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) }; } catch { return { status: r.status, text }; }
};

(async () => {
  const apiKey = process.env.VITE_NREL_API_KEY;
  if (!apiKey) {
    console.error('Missing VITE_NREL_API_KEY. Set it in your environment (e.g., .env) before running this test.');
    process.exit(1);
  }

  // PVWatts sample: 5 kW system in Atlanta, GA
  const pvUrl = `https://developer.nrel.gov/api/pvwatts/v6.json?api_key=${apiKey}&lat=33.749&lon=-84.388&system_capacity=5&module_type=1&losses=14&array_type=1&tilt=25&azimuth=180`;
  const pv = await fetchJson(pvUrl);

  console.log('PVWatts status:', pv.status);
  if (pv.json) {
    const ann = pv.json?.outputs?.ac_annual;
    const solrad = pv.json?.outputs?.solrad_annual;
    console.log('PVWatts annual AC energy (kWh):', ann ?? 'n/a');
    console.log('PVWatts annual solar radiation (kWh/m^2/day):', solrad ?? 'n/a');
  } else {
    console.log('PVWatts raw:', pv.text?.slice(0, 300));
  }

  // Utility rates for Atlanta, GA (address based)
  const urUrl = `https://developer.nrel.gov/api/utility_rates/v3.json?api_key=${apiKey}&address=Atlanta,GA`;
  const ur = await fetchJson(urUrl);
  console.log('\nUtility Rates status:', ur.status);
  if (ur.json) {
    const util = ur.json?.outputs?.utility_info?.utility_name;
    const res = ur.json?.outputs?.residential;
    console.log('Utility name:', util ?? 'n/a');
    console.log('Residential $/kWh (blended):', typeof res === 'number' ? res.toFixed(4) : 'n/a');
  } else {
    console.log('Utility Rates raw:', ur.text?.slice(0, 300));
  }

  console.log('\nURLs tested:\n', pvUrl, '\n', urUrl);
})();
