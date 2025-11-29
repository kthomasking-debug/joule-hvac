// src/components/LearningAcknowledgment.jsx
// Visual and voice confirmation when patterns are detected

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Check, X } from 'lucide-react';
import useVoiceFeedback from '../hooks/useVoiceFeedback';

export default function LearningAcknowledgment({ 
  pattern,
  onAccept,
  onDismiss 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const { speak } = useVoiceFeedback();

  useEffect(() => {
    if (pattern && !isVisible) {
      // Animate in
      setIsVisible(true);
      
      // Speak the prompt after a brief delay
      if (!hasSpoken) {
        setTimeout(() => {
          const message = pattern.type === 'morning-warmup'
            ? `I noticed you often turn the heat up at ${pattern.hour}:00 ${pattern.period}. Want me to just do that automatically from now on?`
            : `I've learned a new pattern. Want me to apply it automatically?`;
          speak(message);
          setHasSpoken(true);
        }, 500);
      }
    }
  }, [pattern, isVisible, hasSpoken, speak]);

  if (!pattern) return null;

  const handleAccept = () => {
    if (onAccept) onAccept(pattern);
    setIsVisible(false);
    speak('Great! I\'ll remember that.');
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss(pattern);
    setIsVisible(false);
    speak('No problem. I won\'t apply this pattern.');
  };

  return (
    <div 
      className={`fixed top-24 right-6 z-50 max-w-sm transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
      }`}
    >
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl shadow-2xl p-5 border-2 border-purple-400/30">
        {/* Animated sparkle icon */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <Brain size={32} className="animate-pulse" />
            <Sparkles 
              size={16} 
              className="absolute -top-1 -right-1 text-yellow-300 animate-bounce" 
            />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Pattern Detected!</h3>
            <p className="text-sm text-purple-100 leading-relaxed">
              {pattern.description || 'I\'ve learned something about your preferences.'}
            </p>
          </div>
        </div>

        {/* Pattern details */}
        {pattern.details && (
          <div className="bg-white/10 rounded-lg p-3 mb-3 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">Pattern:</span>
              <span>{pattern.details.action}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-200">
              <span className="font-semibold">Frequency:</span>
              <span>{pattern.details.frequency} times in {pattern.details.period}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-colors"
          >
            <Check size={18} />
            Yes, Automate
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
