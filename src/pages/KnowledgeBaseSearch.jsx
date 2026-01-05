import React, { useState } from "react";
import { Database, Search, Loader, X, Info, Key } from "lucide-react";
import { queryHVACKnowledge } from "../utils/rag/ragQuery";

/**
 * Knowledge Base Search
 * Dedicated page for searching HVAC documentation and standards
 */
export default function KnowledgeBaseSearch() {
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [showRAGSearch, setShowRAGSearch] = useState(false);
  
  // API key management
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
      
      // Automatically retry search after saving key
      if (ragQuery.trim()) {
        await handleRAGSearch();
      }
    } catch (err) {
      console.error("Error saving API key:", err);
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleRAGSearch = async () => {
    if (!ragQuery.trim()) {
      return;
    }

    setRagLoading(true);
    setRagResults(null);
    setShowRAGSearch(true);

    // Check for Groq API key first
    const groqApiKey = typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
    const model = typeof window !== "undefined" ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile";
    
    if (!groqApiKey || !groqApiKey.trim()) {
      // No API key - show prompt immediately
      setRagLoading(false);
      setShowApiKeyPrompt(true);
      setRagResults({
        success: false,
        message: "Please enter your Groq API key to search the knowledge base.",
        needsApiKey: true
      });
      return;
    }

    try {
      // Run RAG search and Groq in parallel
      const ragPromise = queryHVACKnowledge(ragQuery);
      const groqPromise = (async () => {
        try {
          const { askJouleFallback } = await import("../lib/groqAgent");
          return await askJouleFallback(
            `HVAC technical question: ${ragQuery}\n\nAnswer as a senior HVAC engineer. Be specific about Manual J, load calculations, sizing, BTU requirements, and engineering standards. If this is about ACCA standards (Manual J, S, D, etc.), explain those thoroughly.`,
            groqApiKey,
            model
          );
        } catch (err) {
          console.error("Groq error:", err);
          return { success: false };
        }
      })();

      const [ragResult, groqResult] = await Promise.all([ragPromise, groqPromise]);

      // Prioritize Groq response
      if (groqResult.success && groqResult.message) {
        // Combine RAG results with AI explanation
        if (ragResult.success && ragResult.content) {
          setRagResults({
            success: true,
            content: groqResult.message,
            sources: [
              { title: "AI-Powered Expert Response (Groq)", score: 10 },
              ...(ragResult.sources || [])
            ],
            hasDocumentation: true,
            documentation: ragResult.content,
            isGroqFallback: false,
          });
        } else {
          setRagResults({
            success: true,
            content: groqResult.message,
            sources: [{ title: "AI-Powered Expert Response (Groq)", score: 10 }],
            isGroqFallback: true,
          });
        }
      } else {
        // Groq failed, show RAG results only
        setRagResults(ragResult);
      }
    } catch (err) {
      console.error("Search error:", err);
      setRagResults({ success: false, message: "Failed to search knowledge base." });
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          Knowledge Base Search
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Search HVAC documentation, standards, and engineering resources
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Search Documentation
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Ask questions about Manual J, load calculations, sizing, or HVAC engineering standards. Includes information from user-uploaded PDFs.
        </p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleRAGSearch();
                }
              }}
              placeholder="Example: 'What is Manual J?' or 'How do I calculate heat loss?'"
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={handleRAGSearch}
              disabled={ragLoading || !ragQuery.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ragLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </button>
          </div>
          
          {/* Results */}
          {ragResults && showRAGSearch && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white">Results</h4>
                <button
                  onClick={() => setShowRAGSearch(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {ragResults.success ? (
                <>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose dark:prose-invert max-w-none">
                    {ragResults.content}
                  </div>
                  
                  {/* Show documentation if available */}
                  {ragResults.hasDocumentation && ragResults.documentation && (
                    <details className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-700">
                      <summary className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                        📄 Related Documentation Found (Click to expand)
                      </summary>
                      <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg max-h-96 overflow-y-auto">
                        {ragResults.documentation}
                      </div>
                    </details>
                  )}
                  
                  {ragResults.sources && ragResults.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-700">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources:</p>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {ragResults.sources.map((source, idx) => (
                          <li key={idx}>• {source.title} {source.score && `(relevance: ${source.score.toFixed(1)})`}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {ragResults.message || "No relevant information found."}
                  
                  {/* Inline API Key Input */}
                  {ragResults.needsApiKey && showApiKeyPrompt && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                      <div className="flex items-start gap-2 mb-3">
                        <Key className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white text-sm">
                            Enter Groq API Key for AI Search
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            When documentation isn't found, AI can help answer your question.{" "}
                            <a
                              href="https://console.groq.com/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Get a free API key
                            </a>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={tempApiKey}
                          onChange={(e) => setTempApiKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveApiKey();
                            }
                          }}
                          placeholder="gsk_..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={handleSaveApiKey}
                          disabled={!tempApiKey.trim() || savingApiKey}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                        >
                          {savingApiKey ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          About Knowledge Base Search
        </h3>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <p>
            This tool searches through HVAC documentation, engineering standards, and user-uploaded PDFs
            to help answer technical questions about:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Manual J</strong> — Residential load calculations</li>
            <li><strong>Manual S</strong> — Equipment selection and sizing</li>
            <li><strong>Manual D</strong> — Duct design</li>
            <li><strong>ACCA Standards</strong> — Air Conditioning Contractors of America guidelines</li>
            <li><strong>ASHRAE Standards</strong> — Engineering handbooks and standards</li>
            <li><strong>Equipment Specs</strong> — Heat pump, furnace, and AC specifications</li>
          </ul>
          <p className="mt-3">
            If no documentation is found, the system will attempt to use AI-powered responses based on
            general HVAC knowledge. For best results, be specific in your questions.
          </p>
        </div>
      </div>

      {/* Example Queries */}
      <div className="mt-8 bg-gray-50 dark:bg-gray-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Example Queries</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            "What is Manual J?",
            "How do I calculate heat loss?",
            "What SEER rating do I need?",
            "How to size a heat pump?",
            "What is HSPF2?",
            "Manual S equipment selection process",
            "ACCA duct sizing guidelines",
            "What is balance point temperature?",
          ].map((example, idx) => (
            <button
              key={idx}
              onClick={() => setRagQuery(example)}
              className="text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
            >
              "{example}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
