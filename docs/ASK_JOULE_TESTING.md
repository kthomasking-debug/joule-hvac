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

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify API key is set: `localStorage.getItem('groqApiKey')`
3. Check model availability with test script: `node test-groq-api.js`
4. Review this guide's debugging section
