// src/components/VoiceEnhancedThermostatSuggestions.jsx
// Proactive suggestions with "Tell me more" and "Why?" voice triggers

import React, { useState } from 'react';
import { getThermostatLearningEvents } from '../hooks/useThermostatLearning';
import { Lightbulb, Mic, Volume2 } from 'lucide-react';
import useVoiceFeedback from '../hooks/useVoiceFeedback';
import { recordSavings } from '../lib/savings/savingsAccount';

function analyzeMorningWarmup(events) {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const morning = events.filter(e => e.kind === 'winter' && new Date(e.ts).getTime() >= twoWeeksAgo && e.hour >= 5 && e.hour <= 8 && e.next > e.prev + 1);
  const byHour = new Map();
  for (const e of morning) {
    byHour.set(e.hour, (byHour.get(e.hour) || 0) + 1);
  }
  let bestHour = null;
  let count = 0;
  for (const [h, c] of byHour.entries()) {
    if (c > count) { count = c; bestHour = h; }
  }
  if (count >= 3) {
    return { hour: bestHour, delta: 2, count };
  }
  return null;
}

export default function VoiceEnhancedThermostatSuggestions({ currentWinter, onApply, estimatedSavings = 5 }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('suggestionDismiss') || 'false'); } catch { return false; }
  });
  const [showingDetails, setShowingDetails] = useState(false);
  const { speak, humanize, isSpeaking } = useVoiceFeedback();
  
  const events = getThermostatLearningEvents();
  const morning = analyzeMorningWarmup(events);

  if (dismissed || !morning) return null;

  const rawSuggestion = `Setback to ${(Number(currentWinter) || 70) - 2}°F at night: $${estimatedSavings} monthly savings`;
  const rawEnergy = `Savings: ${estimatedSavings * 7} kWh/week`;

  const applyNow = () => {
    const base = Number(currentWinter) || 70;
    const next = base + morning.delta; // automating warm-up behavior
    try {
      onApply?.(next);
      // Heuristic savings: assume nighttime setback automation improves efficiency modestly
      const assumedMonthlySavings = Number(estimatedSavings) || 5; // from prop
      recordSavings(assumedMonthlySavings / 4, { type: 'automation', kind: 'morning-warmup', hour: morning.hour, appliedTo: next });
      speak(`Automation added. I'll warm to ${next}° at ${morning.hour}:00. Logged projected savings.`);
    } catch (e) {
      console.error('Apply failed:', e);
    }
    setDismissed(true);
    try { localStorage.setItem('suggestionDismiss', 'true'); } catch (e) { console.error(e); }
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('suggestionDismiss', 'true'); } catch (e) { console.error(e); }
  };

  const handleTellMeMore = async () => {
    setShowingDetails(true);
    const humanized = await humanize(rawEnergy);
    speak(humanized, false);
  };

  const handleWhy = async () => {
    const whyText = `I noticed you turn up the heat at ${morning.hour}:00 AM about ${morning.count} times in the last two weeks. I can automate that for you.`;
    speak(whyText);
  };

  return (
    <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Lightbulb className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">Smart Suggestion</h4>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You often warm up the house around {morning.hour}:00 AM. Want to automate that?
          </p>
          
          {showingDetails && (
            <div className="mt-2 p-2 bg-amber-100/50 dark:bg-amber-800/30 rounded text-xs text-amber-900 dark:text-amber-100">
              {rawSuggestion}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={applyNow}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Yes, Automate It
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Dismiss
            </button>
            
            {/* Voice interaction buttons */}
            <button
              onClick={handleTellMeMore}
              disabled={isSpeaking}
              className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Hear the details in everyday terms"
            >
              <Volume2 size={14} />
              Tell Me More
            </button>
            
            <button
              onClick={handleWhy}
              disabled={isSpeaking}
              className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Why are you suggesting this?"
            >
              <Mic size={14} />
              Why?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
