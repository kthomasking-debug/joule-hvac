// src/components/VoiceEnhancedComfortDial.jsx
// Voice-reactive dial with real-time TTS feedback and glow effects

import React, { useState, useEffect, useCallback } from 'react';
import ComfortSavingsDial, { computeSavingsIndex } from './ComfortSavingsDial';
import useVoiceFeedback from '../hooks/useVoiceFeedback';
import { Volume2, VolumeX } from 'lucide-react';

export default function VoiceEnhancedComfortDial({
  winterThermostat = 70,
  summerThermostat = 74,
  seer,
  hspf,
  size = 220,
  onThermostatChange,
  className = ''
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [glowTarget, setGlowTarget] = useState(null); // 'comfort' | 'savings'
  const { speak } = useVoiceFeedback();

  const prevSavingsRef = React.useRef(null);

  const currentSavings = computeSavingsIndex({ winterThermostat, summerThermostat, seer, hspf });

  // Voice feedback on drag changes
  useEffect(() => {
    if (!voiceEnabled || !isDragging) return;

    if (prevSavingsRef.current !== null && prevSavingsRef.current !== currentSavings) {
      const delta = currentSavings - prevSavingsRef.current;
      
      // Calculate estimated cost impact (rough $1.50 per savings point)
      const costDelta = Math.abs(delta * 1.5);

      if (delta > 5) {
        // Moving toward savings
        speak(`That will save about $${costDelta.toFixed(0)} per month.`);
        setGlowTarget('savings');
      } else if (delta < -5) {
        // Moving toward comfort
        speak(`That will add about $${costDelta.toFixed(0)} to your monthly bill.`);
        setGlowTarget('comfort');
      }
    }

    prevSavingsRef.current = currentSavings;
  }, [currentSavings, isDragging, voiceEnabled, speak]);

  // Clear glow after 2 seconds
  useEffect(() => {
    if (glowTarget) {
      const timer = setTimeout(() => setGlowTarget(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [glowTarget]);

  // Handle voice commands to rotate dial automatically
  const handleVoiceCommand = useCallback((command) => {
    const lower = command.toLowerCase();
    
    if (lower.includes('save') || lower.includes('cheaper')) {
      // Move toward savings (lower winter temp)
      const newTemp = Math.max(winterThermostat - 3, 60);
      if (onThermostatChange) {
        onThermostatChange({ winterThermostat: newTemp });
      }
      setGlowTarget('savings');
      speak(`Adjusting for more savings. Setting to ${newTemp} degrees.`);
    } else if (lower.includes('comfort') || lower.includes('warm')) {
      // Move toward comfort (higher winter temp)
      const newTemp = Math.min(winterThermostat + 3, 78);
      if (onThermostatChange) {
        onThermostatChange({ winterThermostat: newTemp });
      }
      setGlowTarget('comfort');
      speak(`Adjusting for more comfort. Setting to ${newTemp} degrees.`);
    }
  }, [winterThermostat, onThermostatChange, speak]);

  // Expose voice command handler globally
  useEffect(() => {
    window.__dialVoiceCommand = handleVoiceCommand;
    return () => {
      delete window.__dialVoiceCommand;
    };
  }, [handleVoiceCommand]);

  return (
    <div className={`relative ${className}`}>
      {/* Voice toggle button */}
      <button
        onClick={() => setVoiceEnabled(!voiceEnabled)}
        className="absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={voiceEnabled ? 'Disable voice feedback' : 'Enable voice feedback'}
      >
        {voiceEnabled ? (
          <Volume2 size={16} className="text-blue-600 dark:text-blue-400" />
        ) : (
          <VolumeX size={16} className="text-gray-400" />
        )}
      </button>

      {/* Glow effect overlay */}
      {glowTarget && (
        <div 
          className={`absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse pointer-events-none ${
            glowTarget === 'savings' ? 'bg-green-400' : 'bg-blue-400'
          }`}
          style={{ transform: 'scale(1.2)' }}
        />
      )}

      {/* Original dial with drag detection */}
      <div
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
      >
        <ComfortSavingsDial
          winterThermostat={winterThermostat}
          summerThermostat={summerThermostat}
          seer={seer}
          hspf={hspf}
          size={size}
        />
      </div>

      {/* Quick +/- buttons for manual adjustments */}
      <div className="mt-3 flex items-center gap-2 justify-center">
        <button
          onClick={() => { if (onThermostatChange) onThermostatChange({ winterThermostat: Math.max(60, winterThermostat - 1) }); }}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm"
        >-</button>
        <div className="text-sm font-semibold">Winter {winterThermostat}°F</div>
        <button
          onClick={() => { if (onThermostatChange) onThermostatChange({ winterThermostat: Math.min(78, winterThermostat + 1) }); }}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm"
        >+</button>
      </div>

      {/* Voice command hint */}
      {voiceEnabled && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
          Say "I want to save money" or "Make it warmer"
        </div>
      )}
    </div>
  );
}
