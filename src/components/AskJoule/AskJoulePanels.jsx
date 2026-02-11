import React from "react";
import { useLocation } from "react-router-dom";
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
  const aiProvider = typeof window !== "undefined" ? (localStorage.getItem("aiProvider") || "local") : "local";
  const hasLocalAI = aiProvider === "local" && (localStorage.getItem("localAIBaseUrl") || "").trim();
  const hasGroq = (localStorage.getItem("groqApiKey") || "").trim();
  const hasAI = hasGroq || hasLocalAI;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Suggested Questions
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {hasAI
            ? hasLocalAI
              ? "Click any question to ask it. Local AI can take 1–6 minutes on slow GPUs."
              : "Click any question to ask it. AI-powered answers use your Groq API key."
            : "Click any question to ask it. These require a Groq API key or local AI (Ollama) in Settings for AI-powered answers."}
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
  showQuestionHelp,
  onSuggestionClick
}) => {
  if (!showQuestionHelp) return null;

  return (
    <div className="mt-3 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      {/* Question Help */}
      {showQuestionHelp && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
          <SampleQuestions onSelectQuestion={onSuggestionClick} />
        </div>
      )}
    </div>
  );
};

