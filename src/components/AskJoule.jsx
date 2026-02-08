import React from "react";
import { X, Trash2 } from "lucide-react";
import { useAskJoule } from "./AskJoule/useAskJoule";
import { AskJouleInput } from "./AskJoule/AskJouleInput";
import { AskJouleResponse } from "./AskJoule/AskJouleResponse";
import { AskJoulePanels } from "./AskJoule/AskJoulePanels";
import "./AskJoule.css";

const AskJoule = (props) => {
  const state = useAskJoule({
    ...props,
    pushAuditLog: props.pushAuditLog,
  });

  return (
    <div className={`w-full ${props.isModal ? "flex flex-col min-h-0 flex-1 overflow-hidden" : ""}`}>
      {/* Response Section - scrollable when in modal; reserve min height so it doesn't collapse when input panel has content */}
      <div className={props.isModal ? "ask-joule-modal-response flex-1 min-h-0 min-h-[35vh] max-h-[55vh] overflow-y-auto overflow-x-hidden" : ""}>
        <AskJouleResponse 
        answer={state.answer}
        agenticResponse={state.agenticResponse}
        error={state.error}
        outputStatus={state.outputStatus}
        loadingMessage={state.loadingMessage}
        showGroqPrompt={state.showGroqPrompt}
        isLoadingGroq={state.isLoadingGroq}
        onRetryGroq={state.handleRetryGroq}
        onCancelGroq={state.handleCancelGroq}
        transcript={state.transcript}
        isListening={state.isListening}
        isSpeaking={state.isSpeaking}
        stopSpeaking={state.stopSpeaking}
        onApiKeySaved={(apiKey) => {
          // Clear error - the next query will automatically use the new API key from localStorage
          state.setError("");
          state.setOutputStatus("");
        }}
      />
      </div>

      {/* Ask Joule Container - Clean Chat Style */}
      <div className={`bg-[#151A21] border border-[#222A35] rounded-xl p-6 ${props.isModal ? "flex-shrink-0 mb-0" : "mb-8"}`}>
        {/* Ask Joule Header - hidden if hideHeader prop is true */}
        {!props.hideHeader && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-[#E8EDF3]">
                  Ask Joule
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium bg-[#B068FF] text-white rounded uppercase tracking-wide">
                  BETA
                </span>
              </div>
              {props.isModal && props.onClose && (
                <button
                  onClick={props.onClose}
                  className="p-1.5 rounded-lg hover:bg-[#222A35] text-[#A7B0BA] hover:text-[#E8EDF3] transition-colors"
                  aria-label="Close"
                  title="Close"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <p className="text-sm text-[#A7B0BA] leading-relaxed">
              Ask about your home's efficiency, comfort, or costs. Get answers about your HVAC system based on your settings and usage data.
            </p>
            <p className="text-xs text-[#7A8594] mt-1.5">
              For comparing a specific bill to your forecast, use <strong className="text-[#A7B0BA]">Monthly Forecast → Got Your Bill? Let's Compare</strong>.
            </p>
          </div>
        )}

          {/* Input Section */}
          <AskJouleInput 
        value={state.value}
        setValue={state.setValue}
        onSubmit={state.handleSubmit}
        isListening={state.isListening}
        toggleListening={state.toggleListening}
        speechEnabled={state.speechEnabled}
        toggleSpeech={state.toggleSpeech}
        isSpeaking={state.isSpeaking}
        suggestions={state.suggestions}
        showSuggestions={state.showSuggestions}
        setShowSuggestions={state.setShowSuggestions}
        inputRef={state.inputRef}
        placeholder={state.placeholder}
        disabled={props.disabled}
        recognitionSupported={state.recognitionSupported}
        setShowQuestionHelp={state.setShowQuestionHelp}
        wakeWordEnabled={state.wakeWordEnabled}
        setWakeWordEnabled={state.setWakeWordEnabled}
        wakeWordSupported={state.wakeWordSupported}
        isWakeWordListening={state.isWakeWordListening}
        wakeWordError={state.wakeWordError}
        salesMode={props.salesMode}
        showQuestionHelp={state.showQuestionHelp}
        isLoadingGroq={state.isLoadingGroq}
        loadingMessage={state.loadingMessage}
        lastResponse={props.isModal ? null : (state.agenticResponse?.success ? state.agenticResponse?.message : null)}
        isModal={props.isModal}
          />

          {/* Panels Section */}
          <AskJoulePanels 
        showQuestionHelp={state.showQuestionHelp}
        onSuggestionClick={(text) => {
          state.setValue(text);
          state.inputRef.current?.focus();
          // Automatically submit the question
          setTimeout(() => {
            state.handleSubmit(null, text);
          }, 100);
        }}
          />
        
        {/* Warning and Clear History */}
        <div className="mt-6 pt-4 border-t border-[#222A35] flex items-center justify-between">
          <p className="text-xs text-[#7C8894]">
            ⚠️ Joule is learning. Verify critical info with a professional.
          </p>
          {state.commandHistory && state.commandHistory.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Clear conversation history?")) {
                  state.clearHistory();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A7B0BA] hover:text-[#E8EDF3] hover:bg-[#222A35] rounded-lg transition-colors"
              title="Clear conversation history"
            >
              <Trash2 size={14} />
              Clear History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AskJoule;
