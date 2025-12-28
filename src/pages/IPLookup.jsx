import React, { useState } from "react";
import { Search, Loader2, Copy, Check, AlertCircle, MapPin, Globe, Building, Clock, Network } from "lucide-react";

/**
 * Reverse IP Address Lookup Tool
 * Look up information about an IP address
 */
export default function IPLookup() {
  const [ipAddress, setIpAddress] = useState("");
  const [ipInfo, setIpInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleLookup = async () => {
    if (!ipAddress.trim()) {
      setError("Please enter an IP address");
      return;
    }

    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress.trim())) {
      setError("Please enter a valid IP address (e.g., 8.8.8.8)");
      return;
    }

    setIsLoading(true);
    setError("");
    setIpInfo(null);

    try {
      // Use ipapi.co (supports CORS, free tier: 1,000 requests/day, no API key needed)
      const response = await fetch(`https://ipapi.co/${ipAddress.trim()}/json/`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check for API errors
      if (data.error) {
        throw new Error(data.reason || "IP lookup failed");
      }

      // Transform ipapi.co format to our display format
      const transformedData = {
        query: data.ip || ipAddress.trim(),
        status: "success",
        country: data.country_name,
        countryCode: data.country_code,
        region: data.region_code,
        regionName: data.region,
        city: data.city,
        zip: data.postal,
        lat: data.latitude,
        lon: data.longitude,
        timezone: data.timezone,
        isp: data.org || (data.asn ? `AS${data.asn}` : null),
        org: data.org,
        as: data.asn ? `AS${data.asn}` : null,
        asname: data.org,
        // Keep original data for JSON export
        _raw: data,
      };

      setIpInfo(transformedData);
    } catch (err) {
      console.error("IP lookup error:", err);
      let errorMessage = err.message || "Failed to lookup IP address. Please try again.";
      
      // Provide more helpful error messages
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (err.message?.includes("HTTP error")) {
        errorMessage = `Server error: ${err.message}. The IP address may be invalid or the service may be temporarily unavailable.`;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLookup();
    }
  };

  const getMyIP = async () => {
    setIsLoading(true);
    setError("");
    setIpAddress("");
    setIpInfo(null);

    try {
      // Get user's own IP address
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      setIpAddress(data.ip);
      // Auto-lookup after getting IP
      setTimeout(() => {
        setIpAddress(data.ip);
        handleLookup();
      }, 100);
    } catch (err) {
      console.error("Failed to get IP:", err);
      setError("Failed to get your IP address");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            Reverse IP Address Lookup
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Look up information about any IP address including location, ISP, and network details
          </p>

          {/* IP Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              IP Address
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="8.8.8.8 or 192.168.1.1"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleLookup}
                disabled={isLoading || !ipAddress.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Lookup
                  </>
                )}
              </button>
              <button
                onClick={getMyIP}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                title="Get my IP address"
              >
                My IP
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter an IPv4 address to look up (e.g., 8.8.8.8)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* IP Information Display */}
          {ipInfo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  IP Information
                </h2>
                <button
                  onClick={() => handleCopy(JSON.stringify(ipInfo, null, 2))}
                  className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy JSON
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* IP Address */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center mb-2">
                    <Network className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address</span>
                  </div>
                  <p className="text-lg font-mono text-gray-900 dark:text-white">{ipInfo.query}</p>
                </div>

                {/* Location */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center mb-2">
                    <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</span>
                  </div>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {ipInfo.city}, {ipInfo.regionName}
                    {ipInfo.country && `, ${ipInfo.country}`}
                  </p>
                  {ipInfo.zip && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">ZIP: {ipInfo.zip}</p>
                  )}
                </div>

                {/* Country */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center mb-2">
                    <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Country</span>
                  </div>
                  <p className="text-lg text-gray-900 dark:text-white">
                    {ipInfo.country} ({ipInfo.countryCode})
                  </p>
                </div>

                {/* Timezone */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center mb-2">
                    <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Timezone</span>
                  </div>
                  <p className="text-lg text-gray-900 dark:text-white">{ipInfo.timezone || "N/A"}</p>
                </div>

                {/* ISP */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center mb-2">
                    <Building className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ISP</span>
                  </div>
                  <p className="text-lg text-gray-900 dark:text-white">{ipInfo.isp || "N/A"}</p>
                </div>

                {/* Organization */}
                {ipInfo.org && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="flex items-center mb-2">
                      <Building className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization</span>
                    </div>
                    <p className="text-lg text-gray-900 dark:text-white">{ipInfo.org}</p>
                  </div>
                )}

                {/* ASN */}
                {ipInfo.as && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md md:col-span-2">
                    <div className="flex items-center mb-2">
                      <Network className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ASN</span>
                    </div>
                    <p className="text-lg text-gray-900 dark:text-white">{ipInfo.as}</p>
                    {ipInfo.asname && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{ipInfo.asname}</p>
                    )}
                  </div>
                )}

                {/* Coordinates */}
                {ipInfo.lat && ipInfo.lon && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md md:col-span-2">
                    <div className="flex items-center mb-2">
                      <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Coordinates</span>
                    </div>
                    <p className="text-lg font-mono text-gray-900 dark:text-white">
                      {ipInfo.lat}, {ipInfo.lon}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${ipInfo.lat},${ipInfo.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline mt-1 inline-block"
                    >
                      View on Google Maps →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> This tool uses ipapi.co (free tier: 1,000 requests/day, no API key required). 
              IP geolocation is approximate and may not be accurate for all locations. 
              Some IPs may show as "Unknown" or have limited information. 
              Private IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) cannot be looked up. 
              IP geolocation is approximate and may not be accurate for all locations. 
              Some IPs may show as "Unknown" or have limited information. 
              Private IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) cannot be looked up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

