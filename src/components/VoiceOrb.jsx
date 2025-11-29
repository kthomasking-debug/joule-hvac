// src/components/VoiceOrb.jsx
// Dynamic "Joule" orb that visualizes listening state with waveform animation

import React, { useEffect, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceOrb({ 
  isListening = false, 
  audioLevel = 0, 
  score = 87, 
  onClick 
}) {
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    if (!isListening) return;
    
    const interval = setInterval(() => {
      setPulsePhase(prev => (prev + 0.1) % (Math.PI * 2));
    }, 50);

    return () => clearInterval(interval);
  }, [isListening]);

  // Generate waveform effect based on audio level
  const waveformRadius = isListening ? 60 + (audioLevel * 20) : 60;
  const pulseScale = isListening ? 1 + Math.sin(pulsePhase) * 0.1 : 1;

  return (
    <div 
      className="relative flex items-center justify-center cursor-pointer"
      onClick={onClick}
      role="button"
      aria-label={isListening ? "Stop listening" : "Start voice interaction"}
    >
      {/* Outer pulse rings (when listening) */}
      {isListening && (
        <>
          <div 
            className="absolute rounded-full bg-blue-400/30 animate-ping"
            style={{
              width: waveformRadius * 2.2,
              height: waveformRadius * 2.2,
              animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
            }}
          />
          <div 
            className="absolute rounded-full bg-blue-500/20"
            style={{
              width: waveformRadius * 2,
              height: waveformRadius * 2,
              transform: `scale(${pulseScale})`
            }}
          />
        </>
      )}

      {/* Main orb */}
      <div 
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
          isListening 
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl shadow-blue-500/50' 
            : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg'
        }`}
        style={{
          width: waveformRadius * 2,
          height: waveformRadius * 2,
          transform: `scale(${pulseScale})`
        }}
      >
        {/* Score display (when not listening) */}
        {!isListening && (
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{score}</div>
            <div className="text-xs text-gray-300">Joule Score</div>
          </div>
        )}

        {/* Microphone icon (when listening) */}
        {isListening && (
          <div className="relative">
            <Mic size={48} className="text-white animate-pulse" />
            {/* Audio level indicator bars */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full transition-all duration-100"
                  style={{
                    height: audioLevel > (i * 0.2) ? 16 : 4,
                    opacity: audioLevel > (i * 0.2) ? 1 : 0.3
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prompt text below orb */}
      {!isListening && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Tap to ask Joule
          </p>
        </div>
      )}
    </div>
  );
}
