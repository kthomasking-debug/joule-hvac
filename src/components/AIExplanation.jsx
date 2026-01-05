import React, { useState } from "react";
import { Info, Zap, Loader } from "lucide-react";

/**
 * Reusable AI Explanation Component
 * Provides a "Generate AI Explanation" button with inline API key input
 * and displays AI-generated explanations using Groq
 * 
 * @param {Object} props
 * @param {string} props.title - Title for the explanation section
 * @param {string} props.prompt - The prompt to send to Groq AI
 * @param {Object} props.data - Optional data object to include in prompt
 * @param {string} props.context - Additional context to include in prompt
 */
export default function AIExplanation({ title = "Explanation (Plain English)", prompt, data, context }) {
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const [tempApiKey, setTempApiKey] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);

  const handleSaveApiKey = async () => {
    if (!tempApiKey.trim()) return;
    
    setSavingApiKey(true);
    try {
      localStorage.setItem("groqApiKey", tempApiKey.trim());
      setShowApiKeyPrompt(false);
      setTempApiKey("");
      // Auto-generate explanation after saving key
      await generateAiExplanation();
    } catch (err) {
      console.error("Error saving API key:", err);
    } finally {
      setSavingApiKey(false);
    }
  };

  const generateAiExplanation = async () => {
    const groqApiKey = typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
    
    // Check if API key exists
    if (!groqApiKey || !groqApiKey.trim()) {
      setShowApiKeyPrompt(true);
      return;
    }

    setAiExplanationLoading(true);
    setShowApiKeyPrompt(false);
    
    try {
      const { askJouleFallback } = await import("../lib/groqAgent");
      const model = typeof window !== "undefined" ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile";
      
      // Build the full prompt
      let fullPrompt = prompt || "Explain this in plain, conversational English:\n\n";
      
      if (context) {
        fullPrompt += `Context:\n${context}\n\n`;
      }
      
      if (data) {
        fullPrompt += `Data:\n${JSON.stringify(data, null, 2)}\n\n`;
      }
      
      fullPrompt += `\nWrite a conversational 3-4 paragraph explanation for a homeowner, not an engineer. Be specific about the actual numbers and settings shown above.`;

      const result = await askJouleFallback(fullPrompt, groqApiKey, model);
      
      if (result.success && result.message) {
        setAiExplanation(result.message);
      }
    } catch (err) {
      console.error("AI explanation error:", err);
      // Silently fail - user can try again
    } finally {
      setAiExplanationLoading(false);
    }
  };

  return (
    <details className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700 mt-4">
      <summary className="cursor-pointer font-semibold text-indigo-900 dark:text-indigo-100 text-sm flex items-center gap-2">
        <Info className="w-4 h-4" />
        {title}
        {aiExplanation && <span className="ml-2 text-xs bg-indigo-600 dark:bg-indigo-500 text-white px-2 py-0.5 rounded">AI-Generated</span>}
      </summary>
      <div className="mt-4 text-sm text-indigo-900 dark:text-indigo-200 space-y-3 leading-relaxed">
        {/* AI Explanation Button */}
        {!aiExplanation && !aiExplanationLoading && (
          <div className="mb-4 pb-4 border-b border-indigo-200 dark:border-indigo-700">
            <button
              onClick={generateAiExplanation}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Generate AI Explanation (Uses Your Groq API Key)
            </button>
          </div>
        )}

        {showApiKeyPrompt && !aiExplanation && !aiExplanationLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Enter your Groq API Key
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="gsk_..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tempApiKey.trim()) {
                    handleSaveApiKey();
                  }
                }}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim() || savingApiKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors"
              >
                {savingApiKey ? "Saving..." : "Save"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Get Free API Key →
              </a>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                No credit card required
              </p>
            </div>
          </div>
        ) : aiExplanationLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader className="w-5 h-5 animate-spin" />
            <span>Generating explanation...</span>
          </div>
        ) : aiExplanation ? (
          <div className="whitespace-pre-line">{aiExplanation}</div>
        ) : null}
      </div>
    </details>
  );
}
