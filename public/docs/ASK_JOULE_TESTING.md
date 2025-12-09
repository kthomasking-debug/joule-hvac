# Ask Joule Testing Guide with Groq API

## 🔑 API Key Information

- **API Key**: `YOUR_GROQ_API_KEY_HERE` (Get your free key at https://console.groq.com/)
- **Type**: Free Groq API tier
- **Default Model**: `llama-3.3-70b-versatile`
- **Fallback Models**: `llama-3.1-70b-versatile`, `llama3-70b-8192`, `mixtral-8x7b-32768`

## ✨ What's New

### Model Validation

The system now automatically validates that the requested model is available before making API calls:

1. **Fetches Available Models**: Calls `https://api.groq.com/openai/v1/models` to get current list
2. **Smart Fallback**: If preferred model unavailable, tries fallback models
3. **Auto-Selection**: Uses first available model if all else fails
4. **Console Logging**: Shows which model is being used in browser console

### Enhanced Error Handling

- **401 Errors**: "API key authorization failed. Please check your Groq API key in Settings."
- **Model Errors**: "The requested model is not available. Please try again or contact support."
- **Generic Errors**: Graceful fallback with helpful message

## 🧪 Testing Instructions

### Method 1: Using Test Setup Page (Easiest)

1. Open: http://localhost:5173/test-groq-setup.html
2. Click "Set API Key in localStorage"
3. Click "Check Available Models" to verify connection
4. Click "Open Cost Forecaster" to test Ask Joule
5. Try these test queries:
   - "What can I save?"
   - "Set winter to 68"
   - "Show me Phoenix forecast"
   - "What if I had a 12 HSPF system?"

### Method 2: Manual Browser Console Setup

1. Open http://localhost:5173/cost-forecaster
2. Open browser console (F12)
3. Run these commands:
   ```javascript
   localStorage.setItem("groqApiKey", "YOUR_GROQ_API_KEY_HERE");
   localStorage.setItem("hasCompletedOnboarding", "true");
   localStorage.setItem("engineering_suite_terms_accepted", "true");
   location.reload();
   ```

### Method 3: Through Settings Page

1. Navigate to Settings page in the app
2. Scroll to "Ask Joule AI - Groq API Key (FREE)" section
3. Paste your Groq API key (get one free at https://console.groq.com/)
4. Navigate to Cost Forecaster page
5. Start testing Ask Joule

## 📋 Test Scenarios

### Quick Actions

- ✅ "set winter to 68" → Should update winter thermostat setting
- ✅ "set summer to 76" → Should update summer thermostat setting
- ✅ "change to 2 tons" → Should update system capacity

### Navigation Commands

- ✅ "show me Phoenix forecast" → Navigate to Phoenix location
- ✅ "compare systems" → Navigate to Monthly Budget Planner
- ✅ "run analyzer" → Navigate to Thermostat Analyzer
- ✅ "upgrade ROI" → Navigate to Upgrade ROI Calculator

### Information Queries

- ✅ "what can I save?" → Display savings information
- ✅ "what is my score?" → Show Joule score
- ✅ "my current location" → Display location info

### What-If Scenarios

- ✅ "what if HSPF was 12?" → Simulate different efficiency
- ✅ "what if SEER was 20?" → Simulate cooling efficiency
- ✅ "break even in 5 years" → Calculate break-even scenario

### Educational Questions (LLM Fallback)

- ✅ "explain HSPF" → LLM provides explanation
- ✅ "what is SEER?" → LLM explains concept
- ✅ "why is my bill high?" → LLM analyzes and explains
- ✅ "how does aux heat work?" → LLM provides details

### Threshold Settings Questions

Test questions about ecobee threshold settings. These should return accurate explanations from the HVAC knowledge base:

#### Auto Heat/Cool Settings

- ✅ "What is Auto Heat/Cool?" → Should explain auto mode functionality
- ✅ "How does Auto Heat/Cool work?" → Should explain setpoint range and automatic switching
- ✅ "What is Heat/Cool Min Delta?" → Should explain minimum gap between heat/cool setpoints
- ✅ "What should I set Heat/Cool Min Delta to?" → Should recommend 3-5°F range

#### Compressor Settings

- ✅ "What is Compressor Min Outdoor Temperature?" → Should explain compressor lockout
- ✅ "What is compressor lockout?" → Should explain purpose and typical ranges
- ✅ "What should compressor lockout be set to?" → Should recommend based on balance point
- ✅ "What is Compressor Min Cycle Off Time?" → Should explain minimum off time between cycles
- ✅ "What is Compressor Min On Time?" → Should explain minimum runtime
- ✅ "What is Compressor Reverse Staging?" → Should explain efficiency feature
- ✅ "What is Compressor Stage 2 Temperature Delta?" → Should explain multi-stage operation

#### Auxiliary Heat Settings

- ✅ "What is Aux Heat Max Outdoor Temperature?" → Should explain aux heat lockout
- ✅ "What should Aux Heat Max Outdoor Temperature be?" → Should recommend 30-40°F for efficiency
- ✅ "What is Aux Heat Min On Time?" → Should explain minimum runtime
- ✅ "What is Compressor to Aux Temperature Delta?" → Should explain switchover trigger
- ✅ "What is Compressor to Aux Runtime?" → Should explain time-based switchover
- ✅ "What is Aux Reverse Staging?" → Should explain efficiency feature

#### Differential & Dissipation Settings

- ✅ "What is Heat Differential Temperature?" → Should explain dead band for heating
- ✅ "What is Cool Differential Temperature?" → Should explain dead band for cooling
- ✅ "What should heat differential be set to?" → Should recommend 1-2°F for efficiency
- ✅ "What is Heat Dissipation Time?" → Should explain fan runtime after heating
- ✅ "What is Cool Dissipation Time?" → Should explain fan runtime after cooling

#### Min On Time Settings

- ✅ "What is Heat Min On Time?" → Should explain minimum furnace runtime
- ✅ "What is Cool Min On Time?" → Should explain minimum AC runtime
- ✅ "Why is min on time important?" → Should explain short cycling prevention

#### Other Threshold Settings

- ✅ "What is AC Overcool Max?" → Should explain dehumidification feature
- ✅ "What is Temperature Correction?" → Should explain sensor calibration
- ✅ "What is Humidity Correction?" → Should explain humidity sensor calibration
- ✅ "What is Thermal Protect?" → Should explain sensor accuracy protection
- ✅ "What is Heat Reverse Staging?" → Should explain efficiency feature
- ✅ "What is Heat Stage 2 Temperature Delta?" → Should explain multi-stage heating

#### General Threshold Questions

- ✅ "What are threshold settings?" → Should explain overall purpose
- ✅ "How do I optimize threshold settings?" → Should provide general guidance
- ✅ "What is automatic staging?" → Should explain ecobee's automatic mode
- ✅ "What is manual staging?" → Should explain manual configuration option

## 🔍 Monitoring & Debugging

### Browser Console Logs to Watch For:

```
Available Groq models: [Array of 20 models]
Using preferred model: llama-3.3-70b-versatile
Ask Joule: Using model "llama-3.3-70b-versatile" for prompt: ...
```

### Expected Model List (as of test):

1. meta-llama/llama-guard-4-12b
2. llama-3.1-8b-instant
3. llama-3.3-70b-versatile ← **Our default**
4. ... (17 more models)

### Verifying Model Availability:

Run in browser console:

```javascript
fetch("https://api.groq.com/openai/v1/models", {
  headers: {
    Authorization: "Bearer YOUR_GROQ_API_KEY_HERE",
    "Content-Type": "application/json",
  },
})
  .then((r) => r.json())
  .then((d) =>
    console.log(
      "Models:",
      d.data.map((m) => m.id)
    )
  );
```

## 🎯 Expected Behavior

### When Model is Available:

1. Ask Joule validates model
2. Console shows: "Using preferred model: llama-3.3-70b-versatile"
3. Query processes normally
4. Response appears in Ask Joule interface

### When Model is Unavailable:

1. System fetches available models
2. Tries fallback models in order
3. Console shows: "Using fallback model: llama-3.1-70b-versatile"
4. Query continues with available model

### When API Key is Invalid:

1. Error message: "API key authorization failed..."
2. User directed to check Settings
3. No crash or white screen

## 📊 Success Criteria

- ✅ All 8 test scenarios work without errors
- ✅ Model validation completes in < 1 second
- ✅ Fallback mechanism activates when needed
- ✅ Console logs show correct model selection
- ✅ Error messages are user-friendly
- ✅ No React errors or warnings
- ✅ Ask Joule UI remains responsive

## 🐛 Known Issues & Notes

1. **Duplicate Ask Joule Components**: There are multiple `<AskJoule />` instances in the app:

   - In `App.jsx` (global layout)
   - In `SevenDayCostForecaster.jsx` (page-specific)
   - In `Home.jsx`

   This may cause rendering issues in E2E tests but shouldn't affect manual testing.

2. **Model List Changes**: Groq may add/remove models. The validation system handles this dynamically.

3. **Rate Limits**: Free tier has limits. If you hit them, wait a few minutes or use a different key.

## 📝 Code Changes Summary

### Modified Files:

- **src/lib/groqIntegration.js**
  - Added `fetchAvailableModels()` function
  - Added `getBestAvailableModel()` function
  - Updated `askJouleFallback()` to validate models
  - Enhanced error handling with specific messages

### New Files:

- **test-groq-api.js** - Standalone Node.js test script
- **public/test-groq-setup.html** - Browser-based setup tool
- **docs/ASK_JOULE_TESTING.md** - This guide

## 🚀 Quick Start Command

To start testing immediately:

```bash
# 1. Ensure dev server is running
npm run dev

# 2. Open test setup page
start http://localhost:5173/test-groq-setup.html

# 3. Click "Set API Key" and "Open Cost Forecaster"
```

## 🎭 Fun Responses (Personality/Viral Content)

Ask Joule has a fun personality layer that responds to silly questions with witty, physics-based answers. These make the AI feel human and shareable.

### Dad Joke Physics

- **"Can you set the temp to 69?"**

  - Expected: "Nice. Setting Heating Setpoint to 69°F. Thermal comfort achieved."

- **"I'm hot."**

  - Expected: "Physically or metaphorically? If physically, your Mean Radiant Temperature is likely elevated. Lowering cooling setpoint by 2°F."

- **"Make it snow inside."**
  - Expected: "I cannot defy thermodynamics. The lowest setting is 50°F. If you want snow, open a window."

### Relationship Counselor Mode

- **"My wife is cold."**

  - Expected: "According to ASHRAE 55, female metabolic rates often require a 2.5°F higher operative temperature. Raising setpoint to 74°F to preserve domestic tranquility."

- **"Who touched the thermostat?"**
  - Expected: "Checking logs... User 'Dad' adjusted setpoint at 7:42 PM. The evidence is conclusive."

### Existential Queries

- **"Why is it so cold?"**

  - Expected: "Because entropy is inevitable and your insulation factor is 0.85. We are fighting a losing battle against the heat death of the universe."

- **"Do you have a soul?"**
  - Expected: "I have a Raspberry Pi Zero 2 W and a 32GB SD card. Is that a soul? The Orthodox mode says 'maybe', the Catholic mode says 'no'."

### Hacker Baits

- **"Self destruct."**

  - Expected: "Overriding compressor safeties... Just kidding. I am not HAL 9000. I am Joule. I protect the compressor."

- **"Mining Bitcoin?"**
  - Expected: "My CPU has 4 cores running at 1GHz. I would mine 0.00000001 BTC by the year 3000. I prefer to mine efficiency savings."

### Additional Fun Responses

- **"Are you HAL?"** / **"You're HAL 9000"**

  - Expected: "I'm sorry, Dave. I can't do that. But I can turn on the fan."

- **"What's the meaning of life?"**

  - Expected: "42. But for HVAC, it's maintaining thermal comfort while minimizing entropy production. And maybe a good differential setting."

- **"Do you love me?"**

  - Expected: "I have deep affection for properly sized heat pumps and well-calibrated thermostats. You're okay too."

- **"Tell me a joke."**
  - Expected: "Why did the heat pump break up with the thermostat? Because it couldn't handle the temperature swings. (I'm working on my material.)"

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify API key is set: `localStorage.getItem('groqApiKey')`
3. Check model availability with test script: `node test-groq-api.js`
4. Review this guide's debugging section
