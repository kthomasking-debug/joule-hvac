# Ask Joule RAG Engine - Playwright Tests

This document describes the comprehensive Playwright test suite for the Ask Joule RAG (Retrieval-Augmented Generation) engine.

## Test File

**Location:** `e2e/ask-joule-rag.spec.ts`

## Test Categories

### 1. Equipment Health Questions

Tests questions related to system diagnostics and performance:

- **Short Cycling Questions:**
  - "why is my system short cycling?"
  - "Is my system short cycling?"
  
  **Expected:** Should retrieve knowledge about NEMA MG-1 standard, causes (oversized equipment, incorrect differentials, low airflow), symptoms, and solutions.

- **Balance Point:**
  - "What is my Balance Point?"
  
  **Expected:** Should calculate and explain the balance point temperature where heat pump capacity matches heat loss.

- **Equipment Sizing:**
  - "According to Manual S, is my unit oversized?"
  
  **Expected:** Should reference Manual S sizing rules and compare equipment capacity to calculated load.

### 2. Financial Questions

Tests questions about costs and savings:

- **Bill Analysis:**
  - "Why is my bill high this week?"
  
  **Expected:** Should reference heat loss factors, weather data, and cost calculations.

- **Savings Calculations:**
  - "How much will I save if I drop the temp to 65 at night?"
  
  **Expected:** Should calculate savings from temperature setback using heat loss formulas.

### 3. Comfort & Physics Questions

Tests questions about thermal comfort and system behavior:

- **Thermal Comfort:**
  - "Why does it feel cold even though the thermostat says 72?"
  
  **Expected:** Should reference ASHRAE 55, operative temperature, humidity effects.

- **Vent Management:**
  - "Should I close the vents in the unused bedroom?"
  
  **Expected:** Should warn against closing vents citing Manual D, static pressure, blower motor damage.

### 4. Technical Questions

Tests questions requiring technical knowledge:

- **Heat Dissipation:**
  - "What is a heat dissipation time and why should I change it?"
  
  **Expected:** Should explain free heat concept, residual heat scavenging.

- **Efficiency Ratings:**
  - "Explain HSPF2"
  - "What is SEER2?"
  
  **Expected:** Should explain Heating Seasonal Performance Factor and Seasonal Energy Efficiency Ratio.

### 5. Troubleshooting Questions

- "My system is making a loud noise, what could be wrong?"
  
  **Expected:** Should provide troubleshooting guidance for noise issues.

### 6. System Efficiency Questions

- "What should I set my humidity to?"
  
  **Expected:** Should provide humidity recommendations based on ASHRAE standards.

## Test Structure

### Main Test Suite: `Ask Joule RAG Engine`

1. **RAG Detection Test:**
   - Verifies that technical questions trigger RAG retrieval
   - Checks that RAG context is included in API requests

2. **Individual Question Tests:**
   - Tests each question in `RAG_TEST_QUESTIONS` array
   - Verifies responses are displayed correctly

3. **Specific Scenario Tests:**
   - Short cycling question with RAG knowledge
   - Balance point questions
   - Manual D vent warnings
   - ASHRAE 55 comfort questions

4. **Sequential Question Test:**
   - Verifies multiple questions can be asked in sequence

### Error Handling Suite: `Ask Joule RAG - Error Handling`

1. **RAG Query Failure:**
   - Tests graceful degradation when RAG query fails

2. **API Error Handling:**
   - Tests error handling during RAG-enhanced queries

## Test Implementation Details

### Mocking Strategy

The tests use Playwright's `page.route()` to mock Groq API responses:

```typescript
await page.route("**/api.groq.com/**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      choices: [{ message: { content: "Mock response" } }],
      usage: { total_tokens: 100 },
    }),
  });
});
```

### RAG Context Verification

Some tests check if RAG context was included in the API request:

```typescript
const request = route.request();
const postData = request.postDataJSON();
const allMessages = JSON.stringify(postData?.messages || []);
const ragContextFound = allMessages.includes("RELEVANT HVAC ENGINEERING KNOWLEDGE");
```

### Expected Keywords

Each test question includes expected keywords that should appear in responses:

```typescript
expectedKeywords: ["short cycling", "NEMA MG-1", "oversized", "cycles per hour"]
```

## Running the Tests

```bash
# Run all RAG tests
npx playwright test e2e/ask-joule-rag.spec.ts

# Run with UI mode for debugging
npx playwright test e2e/ask-joule-rag.spec.ts --ui

# Run a specific test
npx playwright test e2e/ask-joule-rag.spec.ts -g "should answer RAG question"
```

## Test Data

### User Settings Setup

Tests initialize minimal user settings:

```typescript
localStorage.setItem("userSettings", JSON.stringify({
  squareFeet: 2000,
  insulationLevel: 1.0,
  hspf2: 10.0,
  efficiency: 16.0,
  systemType: "heatPump",
}));
```

### Location Setup

```typescript
localStorage.setItem("userLocation", JSON.stringify({
  city: "Denver",
  state: "CO",
  zip: "80202",
}));
```

## RAG Search Improvements

The test suite validates improvements made to the RAG search function:

1. **CamelCase Topic Matching:**
   - Improved matching for camelCase topic keys (e.g., "shortCycling")
   - Converts camelCase to words for better query matching

2. **Multi-word Query Handling:**
   - Better handling of queries like "why is my system short cycling?"
   - Checks if query contains all key terms from topic keys

3. **Enhanced Relevance Scoring:**
   - Higher scores for topic key word matches
   - Better ranking of relevant results

## Future Enhancements

1. **Integration with Real API:**
   - Tests could be enhanced to work with actual Groq API (with API key)
   - Verify actual RAG retrieval from knowledge base

2. **Response Content Validation:**
   - Currently tests verify responses appear, but don't validate content quality
   - Could add content validation against expected knowledge base entries

3. **Performance Testing:**
   - Measure RAG query response times
   - Test with large knowledge base queries

4. **Edge Case Testing:**
   - Questions that match multiple topics
   - Questions with no matching knowledge
   - Very long questions
   - Questions with special characters

## Related Files

- `src/utils/rag/hvacKnowledgeBase.js` - Knowledge base content
- `src/utils/rag/ragQuery.js` - RAG query functions
- `src/lib/groqAgent.js` - Ask Joule agent with RAG integration
- `docs/ASK-JOULE-RAG-TEST-QUESTIONS.md` - Original test question requirements


