// src/components/VoiceAssistantButton.jsx
// Persistent microphone button for bottom navigation - primary interaction anchor

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceAssistantButton({ 
  isListening = false, 
  isEnabled = true,
  onClick 
}) {
  return (
    <button
      onClick={onClick}
      disabled={!isEnabled}
      className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-2xl ${
        isListening
          ? 'bg-gradient-to-br from-red-500 to-red-700 scale-110 animate-pulse'
          : isEnabled
          ? 'bg-gradient-to-br from-blue-600 to-purple-700 hover:scale-105 hover:shadow-blue-500/50'
          : 'bg-gray-400 cursor-not-allowed'
      }`}
      aria-label={isListening ? 'Stop listening' : 'Start voice assistant'}
    >
      {/* Ripple effect when listening */}
      {isListening && (
        <div className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
      )}

      {/* Microphone icon */}
      {isListening ? (
        <MicOff size={28} className="text-white relative z-10" />
      ) : (
        <Mic size={28} className="text-white relative z-10" />
      )}

      {/* Badge indicator (e.g., for pending suggestions) */}
      {!isListening && isEnabled && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
      )}
    </button>
  );
}
