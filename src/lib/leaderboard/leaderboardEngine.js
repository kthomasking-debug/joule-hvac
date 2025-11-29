// src/lib/leaderboard/leaderboardEngine.js
// Privacy-first neighborhood comparisons using coarse location bins

const MOCK_REGIONAL_DATA = {
  Northeast: { avg: 68, p25: 55, p50: 68, p75: 82, p90: 95, count: 1247 },
  Southeast: { avg: 72, p25: 58, p50: 72, p75: 88, p90: 102, count: 1832 },
  Midwest: { avg: 65, p25: 52, p50: 65, p75: 78, p90: 91, count: 1523 },
  Southwest: { avg: 74, p25: 61, p50: 74, p75: 89, p90: 105, count: 982 },
  West: { avg: 70, p25: 56, p50: 70, p75: 85, p90: 98, count: 1456 },
  Pacific: { avg: 71, p25: 57, p50: 71, p75: 86, p90: 100, count: 1124 },
};

export function getRegionFromState(state) {
  const regionMap = {
    ME: "Northeast",
    NH: "Northeast",
    VT: "Northeast",
    MA: "Northeast",
    RI: "Northeast",
    CT: "Northeast",
    NY: "Northeast",
    NJ: "Northeast",
    PA: "Northeast",
    DE: "Northeast",
    MD: "Northeast",
    VA: "Southeast",
    WV: "Southeast",
    NC: "Southeast",
    SC: "Southeast",
    GA: "Southeast",
    FL: "Southeast",
    AL: "Southeast",
    MS: "Southeast",
    TN: "Southeast",
    KY: "Southeast",
    AR: "Southeast",
    LA: "Southeast",
    OH: "Midwest",
    IN: "Midwest",
    IL: "Midwest",
    MI: "Midwest",
    WI: "Midwest",
    MN: "Midwest",
    IA: "Midwest",
    MO: "Midwest",
    ND: "Midwest",
    SD: "Midwest",
    NE: "Midwest",
    KS: "Midwest",
    OK: "Southwest",
    TX: "Southwest",
    NM: "Southwest",
    AZ: "Southwest",
    CO: "West",
    WY: "West",
    MT: "West",
    ID: "West",
    UT: "West",
    NV: "West",
    WA: "Pacific",
    OR: "Pacific",
    CA: "Pacific",
    AK: "Pacific",
    HI: "Pacific",
  };
  return regionMap[state] || "West";
}

export function computePercentile(score, regional) {
  if (!regional) return 50;
  const { p25, p50, p75, p90 } = regional;
  if (score <= p25) return 25;
  if (score <= p50) return 25 + ((score - p25) / (p50 - p25)) * 25;
  if (score <= p75) return 50 + ((score - p50) / (p75 - p50)) * 25;
  if (score <= p90) return 75 + ((score - p75) / (p90 - p75)) * 15;
  return Math.min(100, 90 + ((score - p90) / p90) * 10);
}

export function getLeaderboardData(jouleScore, userState) {
  const region = getRegionFromState(userState);
  const regional = MOCK_REGIONAL_DATA[region];
  const percentile = computePercentile(jouleScore, regional);
  return {
    region,
    jouleScore,
    percentile: Math.round(percentile),
    regionalAvg: regional?.avg || 70,
    participantCount: regional?.count || 1000,
  };
}

export default getLeaderboardData;
