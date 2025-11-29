// src/components/TranscriptOverlay.jsx
// Floating subtitle-style transcript showing real-time speech recognition

import React from 'react';
import { StopCircle, Send, VolumeX, Volume2 } from 'lucide-react';

export default function TranscriptOverlay({ 
  transcript = '', 
  interimTranscript = '',
  isVisible = false,
  onStop = null,
  onSubmit = null,
  isProcessing = false,
  isSpeaking = false,
  onStopSpeaking = null,
  ttsEnabled = true,
  onToggleTts = null
}) {
  if (!isVisible || (!transcript && !interimTranscript)) return null;

  const hasContent = transcript.trim().length > 0 || interimTranscript.trim().length > 0;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-full px-4">
      <div className="bg-black/80 backdrop-blur-sm text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
          <div className="flex-1">
            {isProcessing ? (
              <p className="text-lg leading-relaxed text-blue-400 italic">
                Processing your request...
              </p>
            ) : (
              <p className="text-lg leading-relaxed">
                <span className="font-medium">{transcript}</span>
                {interimTranscript && (
                  <span className="text-gray-400 italic"> {interimTranscript}</span>
                )}
                <span className="inline-block w-1 h-5 bg-white/70 ml-1 animate-pulse" />
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center">
            {hasContent && onSubmit && !isProcessing && (
              <button
                onClick={onSubmit}
                className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                title="Submit"
              >
                <Send className="w-5 h-5 text-green-400" />
              </button>
            )}
            {onStop && !isProcessing && (
              <button
                onClick={onStop}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Stop listening"
              >
                <StopCircle className="w-5 h-5 text-red-400" />
              </button>
            )}
            {isSpeaking && onStopSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="p-2 hover:bg-yellow-500/20 rounded-lg transition-colors"
                title="Stop speaking"
              >
                <VolumeX className="w-5 h-5 text-yellow-400" />
              </button>
            )}
            {onToggleTts && (
              <button
                onClick={onToggleTts}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                title={ttsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
              >
                {ttsEnabled ? (
                  <Volume2 className="w-5 h-5 text-blue-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                )}
              </button>
            )}
          </div>
        </div>
        {!ttsEnabled && (
          <p className="text-xs text-gray-400 mt-2 text-right">Voice responses muted</p>
        )}
      </div>
    </div>
  );
}
