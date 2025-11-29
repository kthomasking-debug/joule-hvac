import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getSuggestedQuestions, getRandomTip } from '../utils/suggestedQuestions';
import { parseActionButtons, executeAction } from '../utils/actionParser';
import { 
  exportConversationToJSON, 
  exportConversationToText, 
  downloadConversation, 
  copyToClipboard 
} from '../utils/conversationExporter';

export function SuggestedQuestions({ onSelectQuestion }) {
  const location = useLocation();
  const questions = getSuggestedQuestions(location.pathname);

  if (questions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {questions.map((q, idx) => (
        <button
          key={idx}
          onClick={() => onSelectQuestion(q.text)}
          className="px-3 py-1.5 text-xs rounded-full border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          {q.icon} {q.text}
        </button>
      ))}
    </div>
  );
}

export function ActionButtons({ responseText, navigate }) {
  const actions = parseActionButtons(responseText);

  if (actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
      <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Quick actions:</span>
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={() => executeAction(action, navigate)}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function ConversationExportMenu({ history }) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExportJSON = () => {
    const json = exportConversationToJSON(history);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadConversation(json, `ask-joule-${timestamp}.json`, 'application/json');
    setShowMenu(false);
  };

  const handleExportText = () => {
    const text = exportConversationToText(history);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadConversation(text, `ask-joule-${timestamp}.txt`, 'text/plain');
    setShowMenu(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = exportConversationToText(history);
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (history.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
        title="Export conversation"
      >
        📥 Export ({history.length})
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-50">
          <div className="py-1">
            <button
              onClick={handleCopyToClipboard}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
            </button>
            <button
              onClick={handleExportText}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              💾 Download as Text
            </button>
            <button
              onClick={handleExportJSON}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              📄 Download as JSON
            </button>
            <button
              onClick={() => setShowMenu(false)}
              className="w-full text-left px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RandomTip() {
  const [tip] = useState(getRandomTip());

  return (
    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 italic">
      {tip}
    </div>
  );
}
