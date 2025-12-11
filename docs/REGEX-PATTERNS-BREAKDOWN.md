# Regex Patterns Breakdown - Ask Joule Parser

This document provides a detailed breakdown of the regex patterns used in the Ask Joule command parser.

## Table of Contents
1. [Square Feet Parser](#square-feet-parser)
2. [Temperature Parser](#temperature-parser)
3. [City Parser](#city-parser)
4. [Question Detection Patterns](#question-detection-patterns)
5. [Command Patterns](#command-patterns)
6. [Complex Multi-Pattern Matchers](#complex-multi-pattern-matchers)

---

## Square Feet Parser

**Location:** `src/utils/askJouleParser.js:88-101`

### Pattern
```javascript
/((?:\d{1,3}(?:,\d{3})+)|\d{3,6}|\d+(?:\.\d+)?\s*k)\s*(?:sq\s*?ft|square\s*feet|sf)\b/i
```

### Breakdown
```
(                                    # Start capture group 1
  (?:\d{1,3}(?:,\d{3})+)           # Pattern 1: Comma-separated numbers (1,000, 2,500, etc.)
  |                                  # OR
  \d{3,6}                           # Pattern 2: 3-6 digit numbers (1000, 50000, etc.)
  |                                  # OR
  \d+(?:\.\d+)?\s*k                 # Pattern 3: Decimal numbers with 'k' suffix (1.5k, 2k)
)                                    # End capture group 1
\s*                                  # Optional whitespace
(?:sq\s*?ft|square\s*feet|sf)      # Unit: "sq ft", "square feet", or "sf"
\b                                   # Word boundary
```

### Examples
- ✅ `"2,000 sq ft"` → matches `2,000`
- ✅ `"1800 square feet"` → matches `1800`
- ✅ `"1.8k sf"` → matches `1.8k` (converted to 1800)
- ✅ `"5000 sq ft"` → matches `5000`
- ❌ `"2 sq ft"` → too short (needs 3+ digits without comma)
- ❌ `"2000"` → missing unit

---

## Temperature Parser

**Location:** `src/utils/askJouleParser.js:103-113`

### Pattern
```javascript
/(?:at|to|set(?:\s*it)?\s*to)\s*(\d{2})(?:\s*°?\s*F|\s*F)?\b|(\d{2})\s*(?:degrees|°)/
```

### Breakdown
```
(?:at|to|set(?:\s*it)?\s*to)        # Prefix: "at", "to", "set to", "set it to"
\s*                                  # Optional whitespace
(\d{2})                              # Capture: 2-digit temperature
(?:\s*°?\s*F|\s*F)?                  # Optional: "F", "°F", " F", " °F"
\b                                   # Word boundary
|                                    # OR (alternative pattern)
(\d{2})                              # Capture: 2-digit temperature (standalone)
\s*                                  # Optional whitespace
(?:degrees|°)                        # Suffix: "degrees" or "°"
```

### Examples
- ✅ `"set to 72"` → matches `72`
- ✅ `"at 68°F"` → matches `68`
- ✅ `"72 degrees"` → matches `72`
- ✅ `"set it to 70 F"` → matches `70`
- ❌ `"set to 7"` → too short (needs 2 digits)
- ❌ `"set to 100"` → out of range (45-85)

---

## City Parser

**Location:** `src/utils/askJouleParser.js:135-153`

This is a **multi-stage parser** with 4 fallback patterns:

### Pattern 1: Explicit "in City, ST"
```javascript
/\bin\s+([A-Za-z.\-\s]+?,\s*[A-Z]{2})\b/i
```
**Matches:** `"in Chicago, IL"`, `"in New York, NY"`

### Pattern 2: Bare "City, ST"
```javascript
/(^|\s)([A-Z][A-Za-z.\s-]+?,\s*[A-Z]{2})\b/
```
**Matches:** `"Chicago, IL"`, `"New York, NY"` (at start or after space)

### Pattern 3: "in City" (stops at keywords)
```javascript
/\bin\s+([A-Za-z.\s-]+?)(?:,|\s+(?:at|to|set|with|for|on|keep|good|poor|excellent|bad|\d|$))/i
```
**Matches:** `"in Chicago"`, `"in New York"` (stops at stop words)

### Pattern 4: Start-of-string heuristic
```javascript
/^([A-Z][A-Za-z.-]*(?:\s+[A-Z][A-Za-z.-]*)*)\b(?=\s+(?:keep|set|at|to|with|for|on|\d|$))/
```
**Matches:** `"Chicago keep"`, `"New York set"` (capitalized words at start)

### Examples
- ✅ `"in Chicago, IL keep it warm"` → Pattern 1: `"Chicago, IL"`
- ✅ `"Chicago, IL"` → Pattern 2: `"Chicago, IL"`
- ✅ `"in Chicago set to 72"` → Pattern 3: `"Chicago"`
- ✅ `"New York keep warm"` → Pattern 4: `"New York"`

---

## Question Detection Patterns

**Location:** `src/utils/askJouleParser.js:716-750`

### Main Question Pattern
```javascript
/^(how|what|why|when|where|who|which|can\s+i|should\s+i|do\s+i|does|is|are|will|would|could|can\s+you)\b/i
```

### Instructional Question Pattern
```javascript
/^(how\s+(do|can|should|to)|what\s+(should|happens|is|does|can)|should\s+i|can\s+i)\s+/i
```

### "Can You" Question Detection
```javascript
/^can\s+you\s+(tell|explain|show|what|how|why)/i
```

### "Can I" Question Detection
```javascript
/^can\s+i\s+(switch|activate|set|change|turn|open|show|go|navigate)/i
```

### "Can You Set Temperature" (Always Question)
```javascript
/^can\s+you\s+set\s+(?:the\s+)?temperature\s+to/i
```

### Examples
- ✅ `"how do I set the temperature"` → Question (instructional)
- ✅ `"can you tell me about heat pumps"` → Question (can you)
- ✅ `"can I switch to auto mode"` → Question (permission)
- ✅ `"can you set the temperature to 70"` → Question (long form)
- ❌ `"can you set temp to 70"` → Command (short form, polite)

---

## Command Patterns

### Temperature Setting Commands

**Pattern:** `"set heat/cool to X"` or `"heat/cool to X"`
```javascript
/set\s+(?:heat|cool|ac)\s+(?:to\s+)?(\d{2})\b/i
/^(?:heat|cool|ac)\s+to\s+(\d{2})\b/i
```

**Pattern:** Generic `"set temp to X"`
```javascript
/(?:set|change|make)\s+(?:my\s+)?(?:the\s+)?(?:temp|temperature|thermostat)\s+to\s+(\d{1,3})\b/i
```

### Temperature Adjustment Commands

**Pattern:** Increase temperature
```javascript
/(?:make|turn|raise|increase|bump).*?(?:warmer|hotter|up).*?(\d+)/i
/(?:make|turn|raise|increase|bump).*?(?:warmer|hotter|up)/i  // Default 2 degrees
```

**Pattern:** Decrease temperature
```javascript
/(?:make|turn|lower|decrease|drop).*?(?:cooler|colder|down).*?(\d+)/i
/(?:make|turn|lower|decrease|drop).*?(?:cooler|colder|down)/i  // Default 2 degrees
```

### Mode Switching Commands

**Pattern:** Switch to heat/cool/auto/off
```javascript
/(?:switch|change|set|turn).*?(?:to|mode).*?(heat|heating)/i
/(?:switch|change|set|turn).*?(?:to|mode).*?(cool|cooling)/i
/(?:switch|change|set|turn).*?(?:to|mode).*?auto/i
/(?:turn|switch).*?off/i
```

---

## Complex Multi-Pattern Matchers

### Filter/Coil Efficiency Questions

**Location:** `src/utils/askJouleParser.js:248-254`

This uses **5 alternative patterns** to catch various phrasings:

```javascript
// Pattern 1: "could/can/would/does/is a dirty filter"
/(?:could|can|would|does|is)\s+(?:a\s+)?(?:dirty|clogged|filthy|old|worn)\s+(?:filter|air\s+filter|furnace\s+filter|hvac\s+filter)/

// Pattern 2: "could/can/would/does/is a dirty coil"
/(?:could|can|would|does|is)\s+(?:a\s+)?(?:dirty|clogged|filthy|iced|frozen)\s+(?:coil|evaporator\s+coil|condenser\s+coil|indoor\s+coil|outdoor\s+coil)/

// Pattern 3: "dirty filter/coil cause/explain/affect..."
/(?:dirty|clogged|filthy)\s+(?:filter|coil).*?(?:cause|explain|affect|impact|reduce|lower|decrease|hurt|waste|increase\s+energy|use\s+more\s+energy|efficiency|performance)/

// Pattern 4: "why/how using more energy... filter/coil"
/(?:why|how).*?(?:using\s+more\s+energy|energy\s+usage|efficiency\s+drop|working\s+harder|consuming\s+more).*?(?:filter|coil)/

// Pattern 5: "filter/coil explain/cause/why... energy"
/(?:filter|coil).*?(?:explain|cause|why).*?(?:more\s+energy|efficiency|kwh|energy\s+usage)/
```

### Examples
- ✅ `"could a dirty filter cause problems"` → Pattern 1
- ✅ `"is a dirty coil affecting efficiency"` → Pattern 2
- ✅ `"dirty filter explain energy usage"` → Pattern 3
- ✅ `"why using more energy filter"` → Pattern 4
- ✅ `"filter cause why more energy"` → Pattern 5

---

## Short Cycling Detection

**Location:** `src/utils/askJouleParser.js:273-278`

### Pattern (with exclusions)
```javascript
(/^what\s+(?:is|causes?|does)\s+short\s+cycl/.test(q) ||
 /^explain\s+short\s+cycl/.test(q) ||
 (/short\s+cycl/.test(q) && /^what\s+(?:is|causes?)/.test(q))) &&
!/^(?:why|how)\s+(?:is|are|does)\s+(?:my|the|your)/.test(q)
```

**Matches:**
- ✅ `"what is short cycling"` → General knowledge question
- ✅ `"what causes short cycling"` → General knowledge question
- ✅ `"explain short cycling"` → General knowledge question
- ❌ `"why is my system short cycling"` → Specific problem (needs LLM)
- ❌ `"how does my system short cycle"` → Specific problem (needs LLM)

---

## Schedule Query Patterns

**Location:** `src/utils/askJouleParser.js:678-703`

### Pattern 1: Specific Day
```javascript
/(?:schedule\s+(?:for\s+)?|(?:my\s+)?(?:schedule\s+for\s+)?)(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
```

### Pattern 2: General Schedule
```javascript
/(?:what'?s?|what\s+is|show\s+me|tell\s+me)\s+(?:my\s+)?(?:schedule|weekly\s+schedule)/i
/^(?:my\s+)?(?:schedule|weekly\s+schedule)\s*$/i
```

### Examples
- ✅ `"schedule for wednesday"` → Pattern 1: `wednesday`
- ✅ `"what is my schedule"` → Pattern 2: general schedule
- ✅ `"schedule"` → Pattern 2: general schedule

---

## Key Regex Concepts Used

### Non-Capturing Groups `(?:...)`
Used to group patterns without capturing them. Example:
```javascript
/(?:set|change|adjust)/  // Matches "set", "change", or "adjust" but doesn't capture
```

### Word Boundaries `\b`
Ensures matches occur at word boundaries. Example:
```javascript
/\btemp\b/  // Matches "temp" but not "temperature"
```

### Lookahead `(?=...)`
Positive lookahead - matches pattern without consuming it. Example:
```javascript
/\d+(?=\s+degrees)/  // Matches digits followed by " degrees" but doesn't consume " degrees"
```

### Lazy Quantifiers `*?` and `+?`
Non-greedy matching - matches as few characters as possible. Example:
```javascript
/.+?stop/  // Matches up to "stop" (lazy)
```

### Alternation `|`
Matches one of several patterns. Example:
```javascript
/(?:heat|cool|auto)/  // Matches "heat", "cool", or "auto"
```

---

## Performance Notes

1. **Order Matters**: Patterns are checked in order of specificity (most specific first)
2. **Early Returns**: Functions return immediately on match to avoid unnecessary checks
3. **Case Insensitivity**: Most patterns use `/i` flag for case-insensitive matching
4. **Word Boundaries**: Used extensively to prevent partial word matches
5. **Non-Capturing Groups**: Used to reduce memory overhead when capture isn't needed

---

## Testing Regex Patterns

To test these patterns, you can use:

```javascript
const pattern = /your-regex-here/i;
const testString = "your test string";
const match = testString.match(pattern);
console.log(match);  // Shows captured groups
```

Or use online tools:
- [Regex101](https://regex101.com/)
- [RegExr](https://regexr.com/)

---

_Last updated: 2025-01-27_


