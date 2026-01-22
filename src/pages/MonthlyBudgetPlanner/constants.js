// Constants for MonthlyBudgetPlanner component

export const BASE_BTU_PER_SQFT = 22.67;
export const BASE_COOLING_LOAD_FACTOR = 28.0;

// US State abbreviations to full names for input like "Chicago, IL"
export const STATE_NAME_BY_ABBR = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

// Typical monthly HDD distribution (represents % of annual total)
export const MONTHLY_HDD_DIST = [
  15.2, 13.8, 11.5, 6.8, 2.9, 0.5, 0.1, 0.2, 1.5, 5.6, 10.9, 14.8,
];

// Typical monthly CDD distribution (represents % of annual total)
export const MONTHLY_CDD_DIST = [
  0.3, 0.5, 1.8, 5.2, 12.5, 20.8, 25.6, 24.1, 9.2, 1.8, 0.2, 0.0,
];

// Helper function to normalize strings for comparison
export const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
