import React from "react";
import { useLocation } from "react-router-dom";
import PreferencePanel from "../PreferencePanel";
import LocationSettings from "../LocationSettings";
import { getSuggestedQuestions } from "../../utils/suggestedQuestions";

// Sample commands that users can try (only actual commands, not questions)
const SAMPLE_COMMANDS = [
  { text: "Set temperature to 72", category: "temperature", icon: "🌡️" },
  { text: "Set to heat mode", category: "mode", icon: "🔥" },
  { text: "Set to cool mode", category: "mode", icon: "❄️" },
  { text: "Make it warmer", category: "adjust", icon: "⬆️" },
  { text: "Make it cooler", category: "adjust", icon: "⬇️" },
  { text: "Increase temperature by 2", category: "adjust", icon: "➕" },
  { text: "Decrease temperature by 2", category: "adjust", icon: "➖" },
  { text: "Set to sleep mode", category: "preset", icon: "😴" },
  { text: "Activate away mode", category: "preset", icon: "🏠" },
  { text: "Set to home mode", category: "preset", icon: "🏡" },
  { text: "Optimize for comfort", category: "optimize", icon: "😌" },
  { text: "Optimize for savings", category: "optimize", icon: "💰" },
  { text: "Switch to auto mode", category: "mode", icon: "🔄" },
  { text: "Turn on the system", category: "mode", icon: "▶️" },
  { text: "Turn off the system", category: "mode", icon: "⏸️" },
  { text: "Show me the forecast", category: "navigate", icon: "📊" },
  { text: "What's my Joule Score", category: "status", icon: "⭐" },
  { text: "Calculate my savings", category: "calculate", icon: "💵" },
  { text: "Show system status", category: "status", icon: "📈" },
  { text: "Open settings", category: "navigate", icon: "⚙️" },
  { text: "Run analyzer", category: "navigate", icon: "🔍" },
  { text: "What's my heat loss factor", category: "calculate", icon: "🧮" },
  { text: "Show diagnostics", category: "status", icon: "🔧" },
  { text: "Compare systems", category: "calculate", icon: "⚖️" },
  { text: "Set temperature to 68", category: "temperature", icon: "🌡️" },
  { text: "Set temperature to 75", category: "temperature", icon: "🌡️" },
];

function SampleCommands({ onSelectCommand }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Sample Commands
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Click any command to try it. These work without an API key.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_COMMANDS.map((cmd, idx) => (
          <button
            key={idx}
            onClick={() => onSelectCommand(cmd.text)}
            className="px-3 py-1.5 text-xs rounded-full border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            {cmd.icon} {cmd.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SampleQuestions({ onSelectQuestion }) {
  const location = useLocation();
  const questions = getSuggestedQuestions(location.pathname);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Suggested Questions
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Click any question to ask it. These require a Groq API key for AI-powered answers.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onSelectQuestion(q.text || q)}
            className="px-3 py-1.5 text-xs rounded-full border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
          >
            {q.icon || "❓"} {q.text || q}
          </button>
        ))}
      </div>
    </div>
  );
}

export const AskJoulePanels = ({
  showPersonalization,
  showCommandHelp,
  showQuestionHelp,
  showAudit,
  auditLog,
  onSuggestionClick
}) => {
  if (!showPersonalization && !showCommandHelp && !showQuestionHelp && !showAudit) return null;

  return (
    <div className="mt-3 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      {/* Personalization Settings */}
      {showPersonalization && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="space-y-3">
            <PreferencePanel />
            <LocationSettings />
          </div>
        </div>
      )}

      {/* Command Help */}
      {showCommandHelp && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <SampleCommands onSelectCommand={onSuggestionClick} />
        </div>
      )}

      {/* Question Help */}
      {showQuestionHelp && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <SampleQuestions onSelectQuestion={onSuggestionClick} />
        </div>
      )}

      {/* Audit Log */}
      {showAudit && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Recent Activity
          </h3>
          <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-2">
            {auditLog && auditLog.length > 0 ? (
              auditLog.slice().reverse().map((entry, i) => (
                <div key={i} className="text-xs border-b border-gray-200 dark:border-gray-700 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400 mb-1">
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className="font-mono">{entry.key}</span>
                  </div>
                  <div className="text-gray-800 dark:text-gray-200">
                    {entry.newValue !== undefined ? String(entry.newValue) : "Action"}
                  </div>
                  {entry.meta?.comment && (
                    <div className="text-gray-500 italic mt-0.5">
                      "{entry.meta.comment}"
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-xs py-4">
                No activity recorded yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

