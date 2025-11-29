const RatePeriodType = {
  Default: "default",
  Weekday: "weekday",
  Weekend: "weekend",
};

const RateSeason = {
  Summer: "summer",
  Winter: "winter",
  Spring: "spring",
  Fall: "fall",
};

const _rateCache = {}; // In-memory cache for rate fetches

export function parseOpenEiData(data) {
  if (!data) return null;

  // Many OpenEI endpoints return slightly different shapes. Normalise a few common cases.
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : null;
  if (!items || items.length === 0) {
    // Try treating the top-level object as a single rate doc
    const single = data;
    // Try to extract a number from any field if _parseRateDoc fails
    const parsed = _parseRateDoc(single);
    if (parsed) return parsed;
    // Aggressive fallback: scan all numeric fields for a plausible flat rate
    const flat = extractAnyFlatRate(single);
    if (flat > 0 && flat < 5) {
      return {
        touRates: [],
        flatRate: flat,
        utilityName:
          single.utility_name ||
          single.utility ||
          single.name ||
          single.company ||
          "Unknown Utility",
        url: single.url || single.uri || single.source || null,
        aggressive: true,
      };
    }
    return null;
  }

  // If the API returned a list of rate documents (IURDB style), try to find the best candidate
  // Prefer currently active items (no enddate or enddate in the future). If none are active, pick the most recent expired item
  const nowUnix = Math.floor(Date.now() / 1000);
  const activeItems = items.filter(
    (it) => !it.enddate || Number(it.enddate) >= nowUnix
  );
  let allExpired = false;
  let latestEnd = null;
  if (activeItems.length === 0) {
    allExpired = true;
    // find max enddate among items (if present)
    for (const it of items) {
      if (it.enddate) {
        const v = Number(it.enddate);
        if (!latestEnd || v > latestEnd) latestEnd = v;
      }
    }
    // Find the item with the latest enddate
    let latestItem = items[0];
    let maxEnd = items[0]?.enddate ? Number(items[0].enddate) : 0;
    for (const it of items) {
      if (it.enddate && Number(it.enddate) > maxEnd) {
        maxEnd = Number(it.enddate);
        latestItem = it;
      }
    }
    // Try parsing the latest expired item as a fallback
    const fallbackParsed = _parseRateDoc(latestItem, items);
    if (fallbackParsed) {
      fallbackParsed.outdated = true;
      fallbackParsed.lastKnownEnd = latestEnd
        ? new Date(latestEnd * 1000).toISOString()
        : null;
      return fallbackParsed;
    }
    // If energyrates.flatrate exists and looks reasonable, use as fallback
    if (
      latestItem.energyrates &&
      typeof latestItem.energyrates.flatrate === "number" &&
      latestItem.energyrates.flatrate > 0 &&
      latestItem.energyrates.flatrate < 5
    ) {
      return {
        touRates: [],
        flatRate: latestItem.energyrates.flatrate,
        utilityName:
          latestItem.utility_name ||
          latestItem.utility ||
          latestItem.name ||
          latestItem.company ||
          "Unknown Utility",
        url: latestItem.url || latestItem.uri || latestItem.source || null,
        aggressive: true,
        outdated: true,
        lastKnownEnd: latestEnd
          ? new Date(latestEnd * 1000).toISOString()
          : null,
      };
    }
    // Aggressive fallback: scan numeric fields for a plausible flat rate
    const flat = extractAnyFlatRate(latestItem);
    if (flat > 0 && flat < 5) {
      return {
        touRates: [],
        flatRate: flat,
        utilityName:
          latestItem.utility_name ||
          latestItem.utility ||
          latestItem.name ||
          latestItem.company ||
          "Unknown Utility",
        url: latestItem.url || latestItem.uri || latestItem.source || null,
        aggressive: true,
        outdated: true,
        lastKnownEnd: latestEnd
          ? new Date(latestEnd * 1000).toISOString()
          : null,
      };
    }
    // If we reach here, no usable rate was found - return minimal outdated info.
    return {
      touRates: [],
      flatRate: 0,
      utilityName:
        latestItem.utility_name ||
        latestItem.utility ||
        latestItem.name ||
        latestItem.company ||
        "Unknown Utility",
      url: latestItem.url || latestItem.uri || latestItem.source || null,
      outdated: true,
      lastKnownEnd: latestEnd ? new Date(latestEnd * 1000).toISOString() : null,
    };
  }

  // Select the best candidate from available items
  const searchPool = activeItems.length > 0 ? activeItems : items;
  let candidate =
    searchPool.find(
      (it) => getEnergyStructures(it) || it.schedule || it.energyratestructure
    ) || searchPool[0];
  const parsedCandidate = _parseRateDoc(candidate, items);
  if (parsedCandidate && allExpired) {
    parsedCandidate.outdated = true;
    parsedCandidate.lastKnownEnd = latestEnd
      ? new Date(latestEnd * 1000).toISOString()
      : null;
  }
  return parsedCandidate;
}

// Helper: extract common energy rate structure arrays from a document
function getEnergyStructures(doc) {
  if (!doc) return null;
  return (
    doc.energyratestructure ||
    doc.energy_rates ||
    doc.energyRateStructure ||
    doc.energy_rate_structure ||
    doc.energy_rates_structure ||
    null
  );
}

// Aggressive numeric field scan for plausible flat rate
function extractAnyFlatRate(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let found = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && v > 0 && v < 5) {
      // ignore obvious non-rate numeric keys
      if (
        !/date|time|id|revision|eiaid|lat|lon|zip|code|count|kw|kwh|demand|revision/i.test(
          k
        )
      ) {
        if (v > found) found = v;
      }
    } else if (typeof v === "object" && v !== null) {
      const sub = extractAnyFlatRate(v);
      if (sub > found) found = sub;
    }
  }
  return found;
}

// Parse a single rate document into the canonical returned shape
function _parseRateDoc(doc) {
  if (!doc) return null;
  const utilityName =
    doc.utility_name ||
    doc.utility ||
    doc.name ||
    doc.company ||
    "Unknown Utility";
  const url = doc.url || doc.uri || doc.source || null;

  // Try to find a residential plan within the doc
  const ers = getEnergyStructures(doc);
  if (ers && Array.isArray(ers)) {
    const residentialKeywords = [
      "residential",
      "res",
      "res srv",
      "residential service",
      "sc-1",
      "sc1",
      "rate i",
      "rate ii",
      "schedule",
    ];
    const residentialRate =
      ers.find((rate) => {
        const name = (rate.rate_type || rate.name || "").toLowerCase();
        return residentialKeywords.some((k) => name.includes(k));
      }) || ers[0];

    const flatRate =
      (residentialRate &&
        (residentialRate.flat_rate || residentialRate.flatRate)) ??
      doc.flatratebuy ??
      doc.flat_rate ??
      0;

    // Parse TOU schedule if present
    const touRates = [];
    if (
      residentialRate &&
      residentialRate.schedule &&
      Array.isArray(residentialRate.schedule)
    ) {
      for (const period of residentialRate.schedule) {
        const month = period.month || 0;
        const season =
          month >= 6 && month <= 9
            ? RateSeason.Summer
            : month >= 11 || month <= 3
            ? RateSeason.Winter
            : RateSeason.Spring;
        const type = (period.day_of_week || "")
          .toLowerCase()
          .includes("weekday")
          ? RatePeriodType.Weekday
          : RatePeriodType.Weekend;
        const tiers = period.tiers || [];
        for (const tier of tiers) {
          touRates.push({
            label: `${utilityName} ${
              residentialRate.rate_type || residentialRate.name || "Plan"
            } ${tier.tier_name || tier.name || "Tier"}`,
            rate: parseFloat(tier.rate || tier.price || tier.cost || 0),
            startHour: parseInt(
              tier.start_hour || tier.start || tier.from || 0,
              10
            ),
            endHour: parseInt(tier.end_hour || tier.end || tier.to || 24, 10),
            season,
            type,
          });
        }
      }
    }

    // If we found TOU entries, return them; otherwise return a flat rate if available
    if (touRates.length > 0)
      return { touRates, flatRate: flatRate || 0, utilityName, url };
    if (flatRate && flatRate > 0)
      return { touRates: [], flatRate, utilityName, url };
  }

  // No energy structures: try top-level flat rate or energyrates.flatrate
  let anyFlat =
    doc.flatratebuy || doc.flat_rate || doc.flatRate || doc.price || doc.rate;
  if (
    (!anyFlat || !(typeof anyFlat === "number" && anyFlat > 0)) &&
    doc.energyrates &&
    typeof doc.energyrates === "object"
  ) {
    // Support for energyrates.flatrate (used in some OpenEI data)

    if (
      typeof doc.energyrates.flatrate === "number" &&
      doc.energyrates.flatrate > 0 &&
      doc.energyrates.flatrate < 5
    ) {
      anyFlat = doc.energyrates.flatrate;
    }
  }

  // If we found a plausible flat rate at top-level, return that
  if (typeof anyFlat === "number" && anyFlat > 0 && anyFlat < 5) {
    return { touRates: [], flatRate: anyFlat, utilityName, url };
  }

  // Aggressive fallback: scan nested fields for plausible flat rate
  const scanned = extractAnyFlatRate(doc);
  if (scanned > 0 && scanned < 5) {
    return {
      touRates: [],
      flatRate: scanned,
      utilityName,
      url,
      aggressive: true,
    };
  }

  return null;
}

/**
 * Fetches utility rate data from the OpenEI API.
 * @param {string} apiKey - Your NREL API key.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<object>} The parsed rate data.
 */
export async function fetchRates(apiKey, lat, lon) {
  if (!apiKey) {
    throw new Error("API key is missing. Please provide a valid NREL API key.");
  }
  // Simple in-memory cache for rate fetches
  // moved to module scope for reuse across calls
  const endpoint = `https://api.openei.org/utility_rates?version=8&api_key=${apiKey}&format=json&lat=${lat}&lon=${lon}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}: ${response.statusText}`
      );
    }
    const data = await response.json();
    const parsed = parseOpenEiData(data);
    const cacheKey = `${lat},${lon}`;
    _rateCache[cacheKey] = { parsed, raw: data };
    return _rateCache[cacheKey];
  } catch (error) {
    console.error("Failed to fetch or parse utility rates:", error);
    throw error;
  }
}
