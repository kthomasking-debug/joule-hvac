import React from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

// Static placeholder examples - questions that work with Groq API key
const PLACEHOLDER_SUGGESTIONS = [
  "What's my balance point?",
  "Why is my bill so high?",
  "How can I save money?",
  "What's my heat loss factor?",
];

// Sales placeholder examples for customer service context
const SALES_PLACEHOLDER_SUGGESTIONS = [
  "What thermostats are compatible?",
  "Do you ship to Canada?",
  "Is there a monthly fee?",
  "What's included in the box?",
];

export const AskJouleInput = React.memo(({
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
  setShowQuestionHelp,
  wakeWordEnabled,
  setWakeWordEnabled,
  wakeWordSupported,
  isWakeWordListening,
  wakeWordError,
  salesMode = false,
  showQuestionHelp = false,
  isLoadingGroq = false,
  loadingMessage = "",
  lastResponse = null,
  isModal = false
}) => {
  // Static placeholder text - use sales placeholders if in sales mode
  const displayPlaceholder = salesMode ? SALES_PLACEHOLDER_SUGGESTIONS[0] : PLACEHOLDER_SUGGESTIONS[0];

  return (
    <div className="space-y-3">
      {/* Tabs above input */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            showQuestionHelp
              ? "border-blue-500 text-blue-600 dark:text-blue-400" 
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
          onClick={() => {
            // Toggle question help panel
            setShowQuestionHelp((s) => !s);
          }}
          title="Click to show suggested questions"
        >
          Questions
        </button>
      </div>

      {/* Input Box - On its own row */}
      <form
        onSubmit={onSubmit}
        className="w-full"
      >
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => value.length > 2 && suggestions.length > 0 && setShowSuggestions(true)}
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setValue(suggestion);
                    setShowSuggestions(false);
                    // Auto-submit the command immediately with the suggestion value
                    // Use a synthetic event that includes the suggestion text
                    setTimeout(() => {
                      if (onSubmit) {
                        const syntheticEvent = {
                          preventDefault: () => {},
                          target: { value: suggestion }
                        };
                        onSubmit(syntheticEvent, suggestion);
                      }
                    }, 50);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-sm sm:text-base text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons - Inside form so submit works */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="submit"
            className="btn btn-primary px-4 py-2.5 text-sm font-semibold min-w-[80px]"
            disabled={disabled || !value.trim()}
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
                title={isListening ? "Listening... Click to stop" : "Click to speak"}
              >
                {isListening ? (
                  <>
                    <Mic size={16} className="text-white" />
                    <span className="speaking-indicator">
                      <span></span><span></span><span></span>
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSpeech();
                }}
                title={speechEnabled ? "Voice enabled" : "Voice disabled"}
              >
                {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {isSpeaking && (
                  <span className="speaking-indicator">
                    <span></span><span></span><span></span>
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Thinking indicator - in same panel as input so user always sees it (e.g. Joule Bridge) */}
        {isLoadingGroq && loadingMessage && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm font-medium">{loadingMessage}</span>
          </div>
        )}
      </form>

      {/* Last response in same panel when NOT in modal (in modal, response stays in scrollable section above) */}
      {lastResponse && !isLoadingGroq && !isModal && (
        <div className="ask-joule-modal-response mt-3 p-3 rounded-lg bg-[#222A35] border border-[#2d3748] text-[#E8EDF3] text-sm leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto overflow-x-hidden">
          {lastResponse}
          {!/[.!?]\s*$/.test(lastResponse.trim()) && (
            <p className="mt-2 text-xs text-amber-400">Response may be incomplete (stream ended early).</p>
          )}
        </div>
      )}

      {/* Helpful note - moved to less prominent position */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 opacity-60">
        {salesMode 
          ? "Get instant answers about compatibility, pricing, shipping, and features."
          : "Answers based on ASHRAE standards and your home's settings."
        }
      </p>

      {/* Wake Word Toggle - DEMO MODE ONLY */}
      {!isListening && !speechEnabled && wakeWordSupported && recognitionSupported && (
        <div className="mt-2 space-y-2">
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
                <span className="text-orange-500 text-[10px] font-semibold">(DEMO)</span>
              </span>
              {isWakeWordListening && (
                <span className="text-green-600 dark:text-green-400 animate-pulse ml-2">
                  ● Listening
                </span>
              )}
            </label>
            <div className="text-[10px] text-orange-600 dark:text-orange-400 ml-6 italic">
              ⚠️ Browser demo only - requires active screen. Production will use Raspberry Pi.
            </div>
            {wakeWordError && (
              <div className="text-red-500 text-[10px] ml-6" title={wakeWordError}>
                ⚠ {wakeWordError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

