import React from "react";
import { Zap } from "lucide-react";

// Extract text from agentic response - handle various formats
function extractResponseText(response) {
  if (!response) return "";

  // Direct message
  if (response.success && response.message) {
    return response.message;
  }

  // Nested response object
  if (response.response?.message) {
    return response.response.message;
  }

  // String response
  if (typeof response.response === "string") {
    return response.response;
  }

  return "";
}

export const AskJouleResponse = ({
  answer,
  agenticResponse,
  error,
  outputStatus,
  loadingMessage,
  showGroqPrompt,
  isLoadingGroq,
  onRetryGroq,
  onCancelGroq,
  transcript,
  isListening,
}) => {
  // Debug logging
  React.useEffect(() => {
    if (agenticResponse) {
      console.log("[AskJouleResponse] agenticResponse:", agenticResponse);
      console.log(
        "[AskJouleResponse] extracted text:",
        extractResponseText(agenticResponse)
      );
    }
  }, [agenticResponse]);

  // Extract text from agentic response
  const responseText = extractResponseText(agenticResponse);
  const hasContent = answer || responseText;

  return (
    <div className="space-y-3">
      {/* Live Transcript */}
      {isListening && transcript && (
        <div className="text-xs text-blue-600 dark:text-blue-300 animate-pulse">
          {transcript}
        </div>
      )}

      {/* Loading State */}
      {loadingMessage && (
        <div
          className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-pulse"
          data-testid="loading-indicator"
        >
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            {loadingMessage}
          </span>
        </div>
      )}

      {/* Error / Status Message */}
      {error && (
        <div
          className={`p-4 rounded-lg border ${
            outputStatus === "error"
              ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
              : outputStatus === "success"
              ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
              : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
          }`}
          data-testid="error-message"
        >
          {error === "API_KEY_ERROR" ? (
            <div className="space-y-3">
              <div className="font-semibold text-base mb-2">
                🔑 Groq API Key Required
              </div>
              <p className="text-sm">
                Ask Joule needs a free Groq API key to provide AI-powered
                answers. Without it, Ask Joule can only handle simple thermostat
                commands.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold mb-2">
                  How to get your free API key:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                  <li>
                    Visit{" "}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                    >
                      console.groq.com/keys
                    </a>
                  </li>
                  <li>Sign up for a free account (no credit card required)</li>
                  <li>Click "Create API Key"</li>
                  <li>Copy your API key</li>
                  <li>
                    Go to <strong>Settings → Config</strong> in ProStat
                  </li>
                  <li>Paste your API key in the "Groq API Key" field</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Get Free API Key →
                </a>
                <a
                  href="/config"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-semibold text-sm transition-colors"
                >
                  Open Settings
                </a>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                <strong>Why use Groq?</strong> It's free, fast, and runs
                entirely in your browser. Your API key never leaves your device
                - all requests go directly from your browser to Groq's servers.
              </p>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{error}</div>
          )}
        </div>
      )}

      {/* Main Answer - simplified to avoid nested cards */}
      {hasContent && !error && (
        <div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          data-testid="response-card"
        >
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 flex items-center gap-2">
            <Zap size={16} className="text-white fill-current" />
            <span className="text-sm font-semibold text-white">
              Joule Assistant
            </span>
          </div>

          <div className="p-4 text-gray-800 dark:text-gray-200 leading-relaxed">
            <div className="whitespace-pre-wrap" data-testid="response-text">
              {responseText || answer}
            </div>

            {/* Show metadata if available */}
            {agenticResponse?.tokensUsed && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                {agenticResponse.tokensUsed} tokens used
              </div>
            )}
          </div>
        </div>
      )}

      {/* Groq Fallback Prompt - show when no response and not loading */}
      {showGroqPrompt &&
        !isLoadingGroq &&
        !hasContent &&
        !error &&
        !loadingMessage && (
          <div
            className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded"
            data-testid="fallback-prompt"
          >
            <p className="text-sm mb-2 text-gray-700 dark:text-gray-300">
              I didn't understand that command. Send to AI assistant for a
              better answer?
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-primary px-3 py-1 text-xs"
                onClick={onRetryGroq}
                data-testid="send-to-ai-btn"
              >
                Send to AI
              </button>
              <button
                className="btn btn-outline px-3 py-1 text-xs"
                onClick={onCancelGroq}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
