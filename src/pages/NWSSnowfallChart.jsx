import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import climateZones from '../data/climateZones.json';

export default function NWSSnowfallChart() {
  const [query, setQuery] = useState('Blairsville, GA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [zipCode, setZipCode] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [climateZone, setClimateZone] = useState(null);
  const [ieccZone, setIeccZone] = useState(null);
  const [chartKey, setChartKey] = useState(0);

  const fetchNWSData = async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Geocoding: Convert City/State to Lat/Lon (Free OpenStreetMap API)
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=us`);
      const geoData = await geoRes.json();
      if (!geoData.length) throw new Error("Location not found in the US.");
      
      const { lat, lon, display_name } = geoData[0];
      setLocationName(display_name);

      // Fetch Köppen-Geiger Climate Zone
      try {
        const climateRes = await fetch(`http://climateapi.scottpinkelman.com/api/v1/location/${lat}/${lon}`);
        const climateData = await climateRes.json();
        if (climateData.return_values && climateData.return_values.length > 0) {
          setClimateZone(climateData.return_values[0]);
        }
      } catch (climateErr) {
        console.warn('Climate zone data unavailable:', climateErr);
      }

      // Get ZIP code and county via reverse geocoding
      try {
        const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const reverseData = await reverseRes.json();
        const zip = reverseData.address?.postcode;
        let county = reverseData.address?.county;
        const state = reverseData.address?.state;
        const stateCode = reverseData.address?.['ISO3166-2-lvl4']?.split('-')[1]; // e.g., "US-GA" -> "GA"
        
        setZipCode(zip);
        
        // Look up IECC zone from local data
        if (stateCode && county) {
          // Normalize county names (strip suffixes like County, Parish, Borough, Census Area)
          const normalizedCounty = county
            .replace(/ County$/i, '')
            .replace(/ Parish$/i, '')
            .replace(/ Borough$/i, '')
            .replace(/ Census Area$/i, '')
            .trim();

          const countyData = climateZones.counties[stateCode]?.[normalizedCounty] || climateZones.counties[stateCode]?.[county];
          if (countyData) {
            setIeccZone(countyData);
          }
        }
      } catch (geoErr) {
        console.warn('ZIP code lookup failed:', geoErr);
      }

      // 2. NWS Point Lookup: Get the office and grid coordinates
      const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
        redirect: 'follow'
      });
      const pointData = await pointRes.json();
      if (!pointData.properties) throw new Error("NWS data not available for this location.");

      // 3. NWS Grid Data: This contains the quantitative snowfall amount
      const forecastRes = await fetch(pointData.properties.forecastGridData);
      const forecastDataRaw = await forecastRes.json();

      // 4. Parse Snowfall Data
      // The NWS returns snowfall in millimeters over specific time intervals
      const snowValues = forecastDataRaw.properties?.snowfallAmount?.values;
      
      if (!snowValues || snowValues.length === 0) {
        throw new Error("No snowfall forecast data available for this location.");
      }
      
      const chartMap = snowValues.map(item => {
        const date = new Date(item.validTime.split('/')[0]);
        return {
          // Format date for X-Axis (e.g., "Oct 24")
          time: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          timestamp: date.getTime(),
          // Convert mm to inches
          snowfall: item.value ? parseFloat((item.value / 25.4).toFixed(2)) : 0
        };
      });

      setForecastData(chartMap);
      setChartKey((k) => k + 1); // force charts to recalc after data loads
    } catch (err) {
      console.error('NWS Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNWSData('Blairsville, GA');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchNWSData(query);
  };

  const totalPredictedSnow = forecastData.reduce((sum, d) => sum + d.snowfall, 0);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <form onSubmit={handleSearch} className="mb-8 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter US City (e.g. Denver, CO)"
          className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
          {loading ? 'Loading...' : 'Check Forecast'}
        </button>
      </form>

      {error && <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

      {!loading && forecastData.length > 0 && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-gray-100">{locationName}</h1>
            {zipCode && <p className="text-slate-500 dark:text-gray-400">ZIP Code: {zipCode}</p>}
            <p className="text-slate-500 dark:text-gray-400">7-Day Snowfall Forecast (NWS Live Data)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Expected Snowfall</h3>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalPredictedSnow.toFixed(2)}"</p>
            </div>
            <div className="bg-slate-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300">Forecast Confidence</h3>
              <p className="text-3xl font-bold text-slate-600 dark:text-gray-400">NWS High-Res</p>
            </div>
            {climateZone && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-300">Köppen Climate</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{climateZone.koppen_geiger_zone}</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">{climateZone.zone_description}</p>
              </div>
            )}
            {ieccZone && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300">IECC Climate Zone</h3>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{ieccZone.iecc_climate_zone}{ieccZone.iecc_moisture_regime !== 'N/A' ? ieccZone.iecc_moisture_regime : ''}</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{ieccZone.ba_climate_zone}</p>
              </div>
            )}
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-gray-100">Snowfall by Date (Inches)</h2>
            <div className="h-64 min-w-0">
              <ResponsiveContainer key={`bar-${chartKey}`} width="100%" height="100%">
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="snowfall" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Snowfall (in)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-gray-100">Accumulation Trend</h2>
            <div className="h-64 min-w-0">
              <ResponsiveContainer key={`line-${chartKey}`} width="100%" height="100%">
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="snowfall" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {forecastData.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-slate-500 dark:text-gray-400">
          No snow predicted in the next 7 days for this location.
        </div>
      )}

      <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-700">
        <strong>NWS API Usage:</strong> This data is pulled from the National Weather Service 
        Gridpoint Forecast. Snowfall values represent the 6-hour accumulation forecasts.
      </div>
    </div>
  );
}
