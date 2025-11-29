import React from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

// Static placeholder examples - commands that work without Groq API key
const PLACEHOLDER_SUGGESTIONS = [
  "Set temperature to 72",
  "Set to heat mode",
  "Go to analysis page",
  "Show commands",
];

// Sales placeholder examples for customer service context
const SALES_PLACEHOLDER_SUGGESTIONS = [
  "What thermostats are compatible?",
  "Do you ship to Canada?",
  "Is there a monthly fee?",
  "What's included in the box?",
];

export const AskJouleInput = ({
  value,
  setValue,
  onSubmit,
  isListening,
  toggleListening,
  speechEnabled,
  toggleSpeech,
  isSpeaking,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  inputRef,
  placeholder,
  disabled,
  recognitionSupported,
  setShowCommandHelp,
  setShowAudit,
  auditLog,
  showPersonalization,
  setShowPersonalization,
  wakeWordEnabled,
  setWakeWordEnabled,
  wakeWordSupported,
  isWakeWordListening,
  wakeWordError,
  salesMode = false,
}) => {
  // Static placeholder text - use sales placeholders if in sales mode
  const displayPlaceholder = salesMode
    ? SALES_PLACEHOLDER_SUGGESTIONS[0]
    : PLACEHOLDER_SUGGESTIONS[0];

  return (
    <div className="space-y-2">
      <form
        onSubmit={onSubmit}
        className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-2"
      >
        <div className="flex-1 relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() =>
              value.length > 2 &&
              suggestions.length > 0 &&
              setShowSuggestions(true)
            }
            placeholder={value ? placeholder : displayPlaceholder}
            className="w-full p-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none transition-all duration-300"
            aria-label="Ask Joule"
            disabled={disabled}
          />
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setValue(suggestion);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-sm sm:text-base text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="btn btn-primary px-4 py-2.5 text-sm font-semibold min-w-[80px]"
            disabled={disabled}
          >
            Ask
          </button>

          {recognitionSupported && (
            <>
              <button
                type="button"
                className={`btn px-2.5 py-2 text-xs flex items-center gap-1.5 ${
                  isListening ? "btn-primary listening-pulse" : "btn-outline"
                }`}
                onClick={toggleListening}
                title={
                  isListening ? "Listening... Click to stop" : "Click to speak"
                }
              >
                {isListening ? (
                  <>
                    <Mic size={16} className="text-white" />
                    <span className="speaking-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  </>
                ) : (
                  <MicOff size={16} />
                )}
              </button>

              <button
                type="button"
                className={`btn px-2.5 py-2 text-xs flex items-center gap-1.5 ${
                  speechEnabled ? "btn-primary" : "btn-outline"
                }`}
                onClick={toggleSpeech}
                title={speechEnabled ? "Voice enabled" : "Voice disabled"}
              >
                {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {isSpeaking && (
                  <span className="speaking-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                )}
              </button>
            </>
          )}

          <div className="flex items-center gap-1.5 border-l border-gray-300 dark:border-gray-600 pl-1.5 ml-0.5">
            <button
              type="button"
              className="btn btn-outline px-2 py-2 text-xs font-medium"
              onClick={() => setShowCommandHelp((s) => !s)}
            >
              Commands
            </button>
            <button
              type="button"
              className="btn btn-outline px-2 py-2 text-xs font-medium"
              onClick={() => setShowAudit((s) => !s)}
            >
              History
              {auditLog && auditLog.length > 0 ? ` (${auditLog.length})` : ""}
            </button>
          </div>
        </div>
      </form>

      {/* Helpful note - moved to less prominent position */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 opacity-60">
        {salesMode
          ? "Get instant answers about compatibility, pricing, shipping, and features."
          : "Answers based on ASHRAE standards and your home's settings."}
      </p>

      {/* Settings Toggle */}
      {!isListening && !speechEnabled && (
        <div className="mt-2 space-y-2">
          <button
            onClick={() => setShowPersonalization((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <span>{showPersonalization ? "▼" : "▶"}</span>
            <span>Settings</span>
          </button>

          {/* Wake Word Toggle - DEMO MODE ONLY */}
          {wakeWordSupported && recognitionSupported && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex items-center gap-1">
                  <span>Wake Word: "Hey Pico"</span>
                  <span className="text-orange-500 text-[10px] font-semibold">
                    (DEMO)
                  </span>
                </span>
                {isWakeWordListening && (
                  <span className="text-green-600 dark:text-green-400 animate-pulse ml-2">
                    ● Listening
                  </span>
                )}
              </label>
              <div className="text-[10px] text-orange-600 dark:text-orange-400 ml-6 italic">
                ⚠️ Browser demo only - requires active screen. Production will
                use Raspberry Pi.
              </div>
              {wakeWordError && (
                <div
                  className="text-red-500 text-[10px] ml-6"
                  title={wakeWordError}
                >
                  ⚠ {wakeWordError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
