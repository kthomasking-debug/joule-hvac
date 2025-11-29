// Simple utility that inspects an input string and determines if
// it likely represents a 'City <space> State' input that is missing
// a comma between the city and state. This is conservative and focuses
// on U.S. states (by full name and two-letter abbreviation).

// Abbreviation -> Full name map (subset is OK; include all 50 states + DC)
const US_STATE_ABBR = {
    'AL': 'Alabama','AK': 'Alaska','AZ': 'Arizona','AR': 'Arkansas','CA': 'California','CO': 'Colorado','CT': 'Connecticut','DE': 'Delaware','FL': 'Florida','GA': 'Georgia','HI': 'Hawaii','ID': 'Idaho','IL': 'Illinois','IN': 'Indiana','IA': 'Iowa','KS': 'Kansas','KY': 'Kentucky','LA': 'Louisiana','ME': 'Maine','MD': 'Maryland','MA': 'Massachusetts','MI': 'Michigan','MN': 'Minnesota','MS': 'Mississippi','MO': 'Missouri','MT': 'Montana','NE': 'Nebraska','NV': 'Nevada','NH': 'New Hampshire','NJ': 'New Jersey','NM': 'New Mexico','NY': 'New York','NC': 'North Carolina','ND': 'North Dakota','OH': 'Ohio','OK': 'Oklahoma','OR': 'Oregon','PA': 'Pennsylvania','RI': 'Rhode Island','SC': 'South Carolina','SD': 'South Dakota','TN': 'Tennessee','TX': 'Texas','UT': 'Utah','VT': 'Vermont','VA': 'Virginia','WA': 'Washington','WV': 'West Virginia','WI': 'Wisconsin','WY': 'Wyoming','DC': 'District of Columbia'
};

const US_STATE_NAMES = new Set(Object.values(US_STATE_ABBR).map(s => s.toLowerCase()));
const US_STATE_ABBR_KEYS = new Set(Object.keys(US_STATE_ABBR));

/**
 * Returns true if the provided input likely contains a city and a state but is missing the comma
 * between them (e.g., "Denver CO" → true). The function is conservative and focuses on US states.
 *
 * @param {string} input
 * @returns {boolean}
 */
export function needsCommaBetweenCityAndState(input) {
    if (!input || typeof input !== 'string') return false;
    const text = input.trim();
    if (text.length === 0) return false;
    // Already containing a comma is fine
    if (text.includes(',')) return false;
    // Break into tokens by whitespace
    const tokens = text.split(/\s+/);
    if (tokens.length < 2) return false; // single token (city only)

    // Helper: check if the last N tokens form a US state name
    const checkLastN = (n) => {
        if (tokens.length < n) return false;
        const start = tokens.length - n;
        const lastN = tokens.slice(start).join(' ');
        return US_STATE_NAMES.has(lastN.toLowerCase());
    };

    // Check last 1, 2, and 3 tokens for full state names (e.g., 'CO' = abbreviation, 'South Carolina' = 2 tokens, 'District of Columbia' = 3 tokens)
    for (let n = 1; n <= 3; n++) {
        if (checkLastN(n)) return true;
    }

    // Finally, check if the last token is a US state abbreviation
    const last = tokens[tokens.length - 1];
    const lastUpper = last.toUpperCase();
    if (lastUpper.length === 2 && US_STATE_ABBR_KEYS.has(lastUpper)) return true;

    return false;
}

export default needsCommaBetweenCityAndState;
