import React from 'react';

const AskJouleHelp = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-3">⚡ Ask Joule User Manual</h1>
        <p className="text-blue-100 text-lg">
          Your AI-powered home energy assistant for HVAC analysis, cost forecasting, and smart thermostat control.
        </p>
      </div>

      {/* Overview */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">What is Ask Joule?</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Ask Joule is a natural language interface that lets you interact with your HVAC system data using voice or text commands. 
          It combines built-in command parsing with optional AI-powered responses via Groq LLM for complex queries.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>💡 Pro Tip:</strong> Add your free Groq API key in Settings to unlock AI-powered answers for complex questions like 
            "analyze my thermostat data" or "why is my bill so high?"
          </p>
        </div>
      </section>

      {/* Command Categories */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Command Categories</h2>
        
        {/* Temperature Control */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-blue-600 dark:text-blue-400">🌡️ Temperature Control</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-blue-600 dark:text-blue-300">"Make it warmer by 2"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Raise temperature</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-blue-600 dark:text-blue-300">"Make it cooler by 3"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lower temperature</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-blue-600 dark:text-blue-300">"Set winter to 68"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Winter thermostat</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-blue-600 dark:text-blue-300">"Set summer to 76"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Summer thermostat</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings & Configuration */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-green-600 dark:text-green-400">⚙️ Settings & Configuration</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Set SEER to 16"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Update efficiency rating</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Set HSPF to 10"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Heating efficiency</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Set utility cost to $0.12"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Electricity rate</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Set square feet to 2000"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Home size</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Set insulation to good"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">poor, average, or good</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-green-600 dark:text-green-300">"Enable aux heat"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Turn on backup heat</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-600 dark:text-purple-400">🧭 Navigation</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Take me to settings"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Open settings page</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Show me the forecast"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">7-day cost forecaster</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Open monthly budget"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Budget planner</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Go to performance analyzer"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Upload CSV data</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Show comparison"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Gas vs heat pump</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-purple-600 dark:text-purple-300">"Take me to charging calculator"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Refrigerant charging</p>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostics & Analysis */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-orange-600 dark:text-orange-400">🔍 Diagnostics & Analysis (AI-Powered)</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            These queries work best with a Groq API key configured:
          </p>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-orange-600 dark:text-orange-300">"Analyze my thermostat data"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Examines uploaded CSV data for patterns</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-orange-600 dark:text-orange-300">"Why is my bill so high?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">AI explains potential causes</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-orange-600 dark:text-orange-300">"What problems does my system have?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Checks for short cycling, aux heat issues</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-orange-600 dark:text-orange-300">"What can I save?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Personalized savings recommendations</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-orange-600 dark:text-orange-300">"What is my Joule Score?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">System efficiency rating</p>
              </div>
            </div>
          </div>
        </div>

        {/* What-If Scenarios */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400">💭 What-If Scenarios</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-indigo-600 dark:text-indigo-300">"What if I upgrade to 18 SEER?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Calculates savings with higher efficiency</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-indigo-600 dark:text-indigo-300">"What if HSPF was 10.5?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Heating efficiency impact</p>
              </div>
            </div>
          </div>
        </div>

        {/* Educational */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-3 text-teal-600 dark:text-teal-400">📚 Educational Queries</h3>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-teal-600 dark:text-teal-300">"What is HSPF?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Explains heating efficiency</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-teal-600 dark:text-teal-300">"What is SEER?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Explains cooling efficiency</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-teal-600 dark:text-teal-300">"Explain aux heat"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Auxiliary heat systems</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <code className="text-teal-600 dark:text-teal-300">"What's normal for Denver?"</code>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Climate-specific guidance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Features */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">🎤 Voice Features</h2>
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Speech Recognition</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>Click the microphone icon to start voice input</li>
              <li>Supports Chrome desktop (best) and Edge</li>
              <li>Auto-submits when you finish speaking</li>
              <li>Handles continuous listening with auto-restart</li>
            </ul>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Text-to-Speech (TTS)</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>Toggle TTS in Ask Joule panel to hear responses</li>
              <li>Works with both built-in commands and AI responses</li>
              <li>Friendly personality mode for natural speech</li>
              <li>Automatically speaks confirmations and error messages</li>
            </ul>
          </div>
        </div>
      </section>

      {/* AI Mode */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">🤖 AI Mode</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Access AI Mode from the mode switcher in the header to get a full-screen AI assistant experience with:
        </p>
        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
          <li>Weather-aware background animations</li>
          <li>Predictive temperature control recommendations</li>
          <li>Voice-first interface optimized for hands-free operation</li>
          <li>Automatic Groq AI fallback for complex queries</li>
        </ul>
      </section>

      {/* Setup Guide */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">🚀 Setup Guide</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Get a Free Groq API Key (Optional but Recommended)</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
              <li>Visit <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">console.groq.com/keys</a></li>
              <li>Sign up for a free account (no credit card required)</li>
              <li>Generate a new API key</li>
              <li>Copy the key (starts with "gsk_")</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. Configure Joule Settings</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
              <li>Go to Settings page</li>
              <li>Paste your Groq API key</li>
              <li>Select your preferred AI model (llama-3.1-8b-instant recommended)</li>
              <li>Enter your home details (square footage, SEER/HSPF, location, etc.)</li>
              <li>Set your electricity and gas rates</li>
            </ol>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Upload Thermostat Data (Optional)</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
              <li>Export CSV from your smart thermostat (ecobee, Nest, Honeywell)</li>
              <li>Go to Performance Analyzer page</li>
              <li>Upload your CSV file</li>
              <li>Ask Joule to "analyze my thermostat data" for insights</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Tips & Tricks */}
      <section className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">💡 Tips & Tricks</h2>
        <ul className="space-y-3 text-gray-700 dark:text-gray-300">
          <li className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">▸</span>
            <span><strong>Be conversational:</strong> Joule understands natural language. Say "make it warmer" instead of "increase temperature by 2".</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">▸</span>
            <span><strong>Use pronouns:</strong> Joule remembers context. Ask "what if it was 18?" after asking about SEER.</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">▸</span>
            <span><strong>Combine queries:</strong> "2000 sq ft in Denver, good insulation, keep it at 70" sets multiple settings at once.</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">▸</span>
            <span><strong>Enable TTS:</strong> Toggle text-to-speech for hands-free operation while working on your HVAC system.</span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">▸</span>
            <span><strong>Upload thermostat data:</strong> For best AI analysis, upload your actual thermostat runtime data.</span>
          </li>
        </ul>
      </section>

      {/* Back Button */}
      <div className="flex justify-center">
        <button
          onClick={() => window.history.back()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
        >
          ← Back to Joule
        </button>
      </div>
    </div>
  );
};

export default AskJouleHelp;
