import React from "react";
import { useAskJoule } from "./AskJoule/useAskJoule";
import { AskJouleInput } from "./AskJoule/AskJouleInput";
import { AskJouleResponse } from "./AskJoule/AskJouleResponse";
import { AskJoulePanels } from "./AskJoule/AskJoulePanels";
import "./AskJoule.css";

const AskJoule = (props) => {
  const state = useAskJoule(props);

  return (
    <div className="w-full">
      {/* Response Section */}
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
      />

      {/* Ask Joule Header - hidden if hideHeader prop is true */}
      {!props.hideHeader && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Ask Joule
            </h3>
            <span className="px-2 py-0.5 text-xs font-bold bg-orange-500 text-white rounded uppercase tracking-wide">
              BETA
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask about your home's efficiency, comfort, or costs. Get answers about your HVAC system based on your settings and usage data.
          </p>
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
            ⚠️ Ask Joule is learning. Verify critical advice with a professional.
          </div>
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
        setShowCommandHelp={state.setShowCommandHelp}
        setShowAudit={state.setShowAudit}
        auditLog={props.auditLog}
        showPersonalization={state.showPersonalization}
        setShowPersonalization={state.setShowPersonalization}
        wakeWordEnabled={state.wakeWordEnabled}
        setWakeWordEnabled={state.setWakeWordEnabled}
        wakeWordSupported={state.wakeWordSupported}
        isWakeWordListening={state.isWakeWordListening}
        wakeWordError={state.wakeWordError}
        salesMode={props.salesMode}
      />

      {/* Panels Section */}
      <AskJoulePanels 
        showPersonalization={state.showPersonalization}
        showCommandHelp={state.showCommandHelp}
        showAudit={state.showAudit}
        auditLog={props.auditLog}
        onSuggestionClick={(text) => {
          state.setValue(text);
          // Optionally submit automatically? Original didn't seemed to.
          state.inputRef.current?.focus();
        }}
      />
    </div>
  );
};

export default AskJoule;
