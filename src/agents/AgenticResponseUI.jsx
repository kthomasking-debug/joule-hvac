/**
 * Agentic AI Response Display
 * Shows agent's reasoning, execution plan, and results with transparency
 */

import React, { useState } from 'react';
import { 
  Brain, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  Target,
  TrendingUp
} from 'lucide-react';

function stripMarkdown(text) {
  if (!text) return text;
  let t = String(text);
  t = t.replace(/^#{1,6}\s*/gm, '')
       .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
       .replace(/\*\*([^*]+)\*\*/g, '$1')
       .replace(/\*([^*]+)\*/g, '$1')
       .replace(/_([^_]+)_/g, '$1')
       .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
       .replace(/```[\s\S]*?```/g, '')
       .replace(/^\s*[-*]\s+/gm, '• ')
       .replace(/^\s*\d+\.\s+/gm, '')
       .replace(/\s+/g, ' ');
  return t.trim();
}

export function AgenticResponse({ result, isProcessing, executionProgress }) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (isProcessing) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4" data-testid="agentic-response">
        <div className="flex items-start gap-3">
          <Brain className="text-blue-600 dark:text-blue-400 animate-pulse flex-shrink-0 mt-1" size={20} />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🤔 Thinking...
            </h4>
            
            {executionProgress.length > 0 && (
              <div className="space-y-2">
                {executionProgress.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                    <Zap size={14} className="text-blue-500" />
                    <span>Running: {step.name || step.tool}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Handle error results (only show error box if it's actually an error)
  if (result.error && !result.success) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" data-testid="agentic-response">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1" size={20} />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">
              Agent Error
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200">
              {result.message || 'An error occurred while processing your query.'}
            </p>
            {result.needsSetup && (
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                Please configure your settings to use this feature.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Extract response text from various formats
  let responseText = '';
  if (result.success && result.message) {
    responseText = stripMarkdown(result.message);
  } else if (typeof result.response === 'string') {
    responseText = stripMarkdown(result.response);
  } else if (result.response?.success && result.response?.message) {
    responseText = stripMarkdown(result.response.message);
  } else if (result.response) {
    responseText = stripMarkdown(
      typeof result.response === 'string' ? result.response : JSON.stringify(result.response, null, 2)
    );
  }

  return (
    <div className="space-y-4" data-testid="agentic-response">
      {/* Main Response */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
          {responseText}
        </div>
      </div>

      {/* Confidence & Metadata */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-gray-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Confidence: {Math.round(result.confidence * 100)}%
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-gray-500" />
          <span className="text-gray-600 dark:text-gray-400">
            {result.executedTools?.length || 0} tools used
          </span>
        </div>

        {result.metadata?.executionTime && (
          <div className="text-gray-600 dark:text-gray-400">
            {result.metadata.executionTime}ms
          </div>
        )}
      </div>

      {/* Expandable Reasoning Section */}
      {result.reasoning && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                Agent Reasoning
              </span>
            </div>
            {showReasoning ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showReasoning && (
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  {result.reasoning}
                </p>
                
                {result.executedTools && result.executedTools.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Tools executed:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.executedTools.map((tool, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs font-medium"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proactive Suggestions */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                💡 Suggestions
              </h4>
              <div className="space-y-2">
                {result.suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
                  >
                    <TrendingUp size={14} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p>{suggestion.message}</p>
                      {suggestion.action && (
                        <button
                          className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline"
                          onClick={() => console.log('Action:', suggestion.action)}
                        >
                          Take action →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Live Execution Monitor
 * Shows real-time agent execution steps
 */
export function ExecutionMonitor({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        <Zap size={18} className="text-blue-600" />
        Execution Progress
      </h4>
      
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 text-sm"
          >
            <div className="flex-shrink-0">
              {step.completed ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : step.error ? (
                <AlertCircle size={16} className="text-red-600" />
              ) : (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {step.name || step.tool}
              </div>
              {step.reason && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {step.reason}
                </div>
              )}
            </div>
            
            {step.duration && (
              <div className="text-xs text-gray-500">
                {step.duration}ms
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Agent Insight Panel
 * Shows what the agent knows and what it needs
 */
export function AgentInsightPanel({ userSettings, missingData }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
        <Brain size={18} />
        Agent Knowledge
      </h4>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">
            ✅ Known
          </div>
          <ul className="space-y-1 text-blue-800 dark:text-blue-200">
            {userSettings.city && <li>• Location: {userSettings.city}</li>}
            {userSettings.squareFeet && <li>• Size: {userSettings.squareFeet} sq ft</li>}
            {userSettings.primarySystem && <li>• System: {userSettings.primarySystem}</li>}
            {userSettings.indoorTemp && <li>• Setpoint: {userSettings.indoorTemp}°F</li>}
          </ul>
        </div>
        
        {missingData && missingData.length > 0 && (
          <div>
            <div className="text-amber-700 dark:text-amber-300 font-medium mb-1">
              ⚠️ Needs
            </div>
            <ul className="space-y-1 text-amber-800 dark:text-amber-200">
              {missingData.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
