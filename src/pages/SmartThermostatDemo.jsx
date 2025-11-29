import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const SmartThermostatDemo = () => {
  const navigate = useNavigate();
  const [currentTemp, setCurrentTemp] = useState(72);
  const [targetTemp, setTargetTemp] = useState(70);
  const [mode, setMode] = useState('auto');
  const [isAway, setIsAway] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Persist speech enabled state to localStorage
  const [speechEnabled, setSpeechEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('thermostatSpeechEnabled');
      return saved !== null ? JSON.parse(saved) : true; // Default to true (voice on)
    } catch {
      return true;
    }
  });
  
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(null);
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const autoSubmitTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Clear auto-submit timers
  const clearAutoSubmitTimers = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSubmitCountdown(null);
    setShouldAutoSubmit(false);
  }, []);

  // Start auto-submit countdown
  const startAutoSubmit = useCallback(() => {
    clearAutoSubmitTimers();
    
    let countdown = 5;
    setAutoSubmitCountdown(countdown);
    
    // Update countdown every second
    countdownIntervalRef.current = setInterval(() => {
      countdown -= 1;
      setAutoSubmitCountdown(countdown);
      if (countdown <= 0) {
        clearInterval(countdownIntervalRef.current);
      }
    }, 1000);
    
    // Trigger auto-submit after 5 seconds
    autoSubmitTimerRef.current = setTimeout(() => {
      setShouldAutoSubmit(true);
    }, 5000);
  }, [clearAutoSubmitTimers]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAiInput(transcript);
        setIsListening(false);
        // Start auto-submit countdown
        startAutoSubmit();
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        clearAutoSubmitTimers();
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    // Cleanup on unmount
    return () => {
      clearAutoSubmitTimers();
    };
  }, [startAutoSubmit, clearAutoSubmitTimers]);

  // Toggle microphone
  const toggleMic = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Toggle speech and persist to localStorage
  const toggleSpeech = () => {
    const newValue = !speechEnabled;
    setSpeechEnabled(newValue);
    try {
      localStorage.setItem('thermostatSpeechEnabled', JSON.stringify(newValue));
    } catch {
      // Ignore storage errors
    }
  };

  // Check if globally muted (from App.jsx mute button)
  const isGloballyMuted = () => {
    try {
      const globalMuted = localStorage.getItem('globalMuted');
      const askJouleMuted = localStorage.getItem('askJouleMuted');
      return globalMuted === 'true' || askJouleMuted === 'true';
    } catch {
      return false;
    }
  };

  // Cancel speech if globally muted (reacts to mute button in header)
  useEffect(() => {
    const checkMute = () => {
      if (isGloballyMuted() && synthRef.current) {
        synthRef.current.cancel();
        setIsSpeaking(false);
      }
    };
    
    // Check immediately
    checkMute();
    
    // Listen for storage changes (when mute button is clicked)
    const handleStorageChange = (e) => {
      if (e.key === 'globalMuted' || e.key === 'askJouleMuted') {
        checkMute();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll for changes (since same-origin storage events don't fire)
    const interval = setInterval(checkMute, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Speak text
  const speak = (text) => {
    // Check both local speechEnabled AND global mute state
    if (!speechEnabled || isGloballyMuted() || !synthRef.current) return;
    
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  // Calculate effective target with away mode adjustment
  const effectiveTarget = useMemo(() => {
    if (!isAway) return targetTemp;
    
    // Away mode adjusts temperature for energy savings
    const awayOffset = 6;
    if (mode === 'heat') {
      return Math.max(60, targetTemp - awayOffset); // Lower heating setpoint
    } else if (mode === 'cool') {
      return Math.min(80, targetTemp + awayOffset); // Raise cooling setpoint
    } else if (mode === 'auto') {
      // In auto, adjust based on current condition
      const tempDiff = currentTemp - targetTemp;
      if (tempDiff > 1) {
        return Math.min(80, targetTemp + awayOffset); // Cooling needed
      } else if (tempDiff < -1) {
        return Math.max(60, targetTemp - awayOffset); // Heating needed
      }
    }
    return targetTemp;
  }, [isAway, targetTemp, mode, currentTemp]);

  // Handle AI submission
  const handleAiSubmit = useCallback((e) => {
    e?.preventDefault();
    clearAutoSubmitTimers();
    
    if (!aiInput.trim()) return;
    
    const input = aiInput.toLowerCase().trim();
    let response = '';
    
    // Parse commands
    if (input.includes('set') && input.includes('to')) {
      const tempMatch = input.match(/(\d+)/);
      if (tempMatch) {
        const temp = parseInt(tempMatch[1]);
        if (temp >= 60 && temp <= 80) {
          setTargetTemp(temp);
          response = `Target temperature set to ${temp} degrees Fahrenheit`;
        } else {
          response = `Temperature must be between 60 and 80 degrees`;
        }
      }
    } else if (input.includes('away')) {
      if (input.includes('on') || input.includes('enable') || input.includes('activate')) {
        setIsAway(true);
        response = 'Away mode activated. Adjusting temperature for energy savings.';
      } else if (input.includes('off') || input.includes('disable') || input.includes('home') || input.includes('back')) {
        setIsAway(false);
        response = 'Away mode deactivated. Welcome home!';
      } else {
        const newAway = !isAway;
        setIsAway(newAway);
        response = newAway ? 'Away mode activated. Adjusting temperature for energy savings.' : 'Away mode deactivated. Welcome home!';
      }
    } else if (input.includes('heat')) {
      setMode('heat');
      response = 'Heat mode activated';
    } else if (input.includes('cool')) {
      setMode('cool');
      response = 'Cool mode activated';
    } else if (input.includes('auto')) {
      setMode('auto');
      response = 'Auto mode activated';
    } else if (input.includes('off')) {
      setMode('off');
      response = 'System turned off';
    } else if (input.includes('status') || input.includes('what')) {
      // Calculate status inline
      const deadband = 1;
      const effectiveTargetForStatus = isAway ? effectiveTarget : targetTemp;
      const tempDiff = currentTemp - effectiveTargetForStatus;
      let status = 'satisfied';
      
      if (mode === 'off') {
        status = 'off';
      } else if (tempDiff > deadband && (mode === 'cool' || mode === 'auto')) {
        status = 'cooling';
      } else if (tempDiff < -deadband && (mode === 'heat' || mode === 'auto')) {
        status = 'heating';
      }
      
      const awayStatus = isAway ? ` Away mode is active, effective target is ${effectiveTargetForStatus} degrees.` : '';
      response = `Current temperature is ${currentTemp} degrees. Target is ${targetTemp} degrees.${awayStatus} System is in ${mode} mode and currently ${status}.`;
    } else {
      response = `I heard: "${aiInput}". Try commands like "set to 72", "heat mode", or "what's the status?"`;
    }
    
    setAiResponse(response);
    setAiInput('');
    
    // Speak response (only if not globally muted)
    setTimeout(() => {
      // Check both local speechEnabled AND global mute state
      if (synthRef.current && response && speechEnabled && !isGloballyMuted()) {
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(response);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
      }
    }, 100);
  }, [aiInput, currentTemp, targetTemp, mode, isAway, effectiveTarget, clearAutoSubmitTimers, speechEnabled]);

  // Auto-submit when flag is set
  useEffect(() => {
    if (shouldAutoSubmit) {
      handleAiSubmit();
      setShouldAutoSubmit(false);
      clearAutoSubmitTimers();
    }
  }, [shouldAutoSubmit, handleAiSubmit, clearAutoSubmitTimers]);

  // Thermostat logic with 2° deadband (uses effectiveTarget for away mode)
  const thermostatState = useMemo(() => {
    const deadband = 1;
    const tempDiff = currentTemp - effectiveTarget;
    
    if (mode === 'off') {
      return { status: 'Off', activeCall: null, statusColor: 'text-gray-600' };
    }
    
    // Call for cooling
    if (tempDiff > deadband) {
      if (mode === 'cool' || mode === 'auto') {
        return { status: 'Cooling', activeCall: 'Y1', statusColor: 'text-cyan-600' };
      }
    }
    
    // Call for heating
    if (tempDiff < -deadband) {
      if (mode === 'heat' || mode === 'auto') {
        return { status: 'Heating', activeCall: 'W1', statusColor: 'text-orange-600' };
      }
    }
    
    return { status: 'Satisfied', activeCall: null, statusColor: 'text-green-600' };
  }, [currentTemp, effectiveTarget, mode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 p-4 md:p-8">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.8); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .float { animation: float 3s ease-in-out infinite; }
        .spin-slow { animation: spin-slow 20s linear infinite; }
        
        .gradient-border {
          position: relative;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 3px;
          border-radius: 24px;
        }
        
        .gradient-border-inner {
          background: white;
          border-radius: 21px;
        }
        
        .dark .gradient-border-inner {
          background: #1f2937;
        }
        
        .glassmorphism {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .dark .glassmorphism {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Joule
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Smart Thermostat Control</p>
              </div>
            </div>
            <nav className="flex gap-2 flex-wrap">
              <button 
                onClick={() => navigate('/')}
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all"
              >
                Home
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                Dashboard
              </button>
              <button 
                onClick={() => navigate('/cost-forecaster')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                Forecast
              </button>
              <button 
                onClick={() => navigate('/monthly-budget')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                Budget
              </button>
              <button 
                onClick={() => navigate('/agent-console')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                Agent
              </button>
            </nav>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Thermostat Display */}
          <div className="lg:col-span-2">
            <div className="gradient-border shadow-2xl">
              <div className="gradient-border-inner p-8">
                {/* Status Bar */}
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">AI Mode Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Voice enabled</span>
                    <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Temperature Display */}
                <div className="text-center mb-8">
                  <div className="relative inline-block">
                    {/* Decorative ring */}
                    <div className="absolute inset-0 rounded-full opacity-20 spin-slow" style={{background: 'conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)'}}></div>
                    
                    {/* Main temperature circle */}
                    <div className="relative bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full p-12 shadow-inner">
                      <div className="text-center">
                        <div className="text-7xl font-bold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                          {currentTemp}°
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current</div>
                        <div className="h-1 w-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 mt-3">
                          Target: {isAway ? effectiveTarget : targetTemp}°
                          {isAway && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              (Away: {targetTemp}° → {effectiveTarget}°)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Status Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="glassmorphism p-4 rounded-xl text-center">
                    <div className="text-2xl mb-2">🌡️</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Mode</div>
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">{mode}</div>
                  </div>
                  <div className="glassmorphism p-4 rounded-xl text-center">
                    <div className="text-2xl mb-2">{thermostatState.status === 'Cooling' ? '❄️' : thermostatState.status === 'Heating' ? '🔥' : '✓'}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</div>
                    <div className={`text-sm font-bold ${thermostatState.statusColor}`}>{thermostatState.status}</div>
                  </div>
                  <button 
                    onClick={() => setIsAway(!isAway)}
                    className={`glassmorphism p-4 rounded-xl text-center transition-all hover:scale-105 ${
                      isAway ? 'ring-2 ring-blue-500' : ''
                    }`}
                    title={isAway ? 'Click to return home' : 'Click to activate away mode'}
                  >
                    <div className="text-2xl mb-2">{isAway ? '🚗' : '🏠'}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Mode</div>
                    <div className={`text-sm font-bold ${isAway ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                      {isAway ? 'Away' : 'Home'}
                    </div>
                    {isAway && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">💰 Saving</div>
                    )}
                  </button>
                </div>

                {/* Temperature Sliders */}
                <div className="mb-6 space-y-4">
                  {/* Target Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Temperature</span>
                      <span className="text-xs text-gray-500">60°F - 80°F</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" 
                      max="80" 
                      value={targetTemp}
                      onChange={(e) => setTargetTemp(Number(e.target.value))}
                      className="w-full h-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>60°</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{targetTemp}°</span>
                      <span>80°</span>
                    </div>
                  </div>
                  
                  {/* Current Temperature (Simulated) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Current Temperature <span className="text-xs text-gray-500">(simulated)</span>
                      </span>
                      <span className="text-xs text-gray-500">60°F - 80°F</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" 
                      max="80" 
                      value={currentTemp}
                      onChange={(e) => setCurrentTemp(Number(e.target.value))}
                      className="w-full h-3 bg-gradient-to-r from-cyan-400 via-gray-400 to-orange-400 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>60°</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{currentTemp}°</span>
                      <span>80°</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <button 
                      onClick={() => setMode('heat')}
                      className={`p-3 ${mode === 'heat' ? 'bg-gradient-to-br from-orange-600 to-red-600 ring-2 ring-orange-400' : 'bg-gradient-to-br from-orange-500 to-red-500'} hover:from-orange-600 hover:to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all`}
                    >
                      <div className="text-xl mb-1">🔥</div>
                      <div className="text-xs font-medium">Heat</div>
                    </button>
                    <button 
                      onClick={() => setMode('cool')}
                      className={`p-3 ${mode === 'cool' ? 'bg-gradient-to-br from-cyan-600 to-blue-600 ring-2 ring-cyan-400' : 'bg-gradient-to-br from-cyan-500 to-blue-500'} hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all`}
                    >
                      <div className="text-xl mb-1">❄️</div>
                      <div className="text-xs font-medium">Cool</div>
                    </button>
                    <button 
                      onClick={() => setMode('auto')}
                      className={`p-3 ${mode === 'auto' ? 'bg-gradient-to-br from-green-600 to-emerald-600 ring-2 ring-green-400' : 'bg-gradient-to-br from-green-500 to-emerald-500'} hover:from-green-600 hover:to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all`}
                    >
                      <div className="text-xl mb-1">🌬️</div>
                      <div className="text-xs font-medium">Auto</div>
                    </button>
                    <button 
                      onClick={() => setMode('off')}
                      className={`p-3 ${mode === 'off' ? 'bg-gradient-to-br from-gray-600 to-gray-700 ring-2 ring-gray-400' : 'bg-gradient-to-br from-gray-500 to-gray-600'} hover:from-gray-600 hover:to-gray-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all`}
                    >
                      <div className="text-xl mb-1">⭕</div>
                      <div className="text-xs font-medium">Off</div>
                    </button>
                  </div>
                  
                  {/* Away Mode Button */}
                  <button 
                    onClick={() => setIsAway(!isAway)}
                    className={`w-full p-3 ${isAway ? 'bg-gradient-to-br from-purple-600 to-blue-600 ring-2 ring-purple-400' : 'bg-gradient-to-br from-purple-500 to-blue-500'} hover:from-purple-600 hover:to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-xl">{isAway ? '🚗' : '🏠'}</div>
                      <div className="text-sm font-medium">{isAway ? 'Away Mode Active - Click to Return Home' : 'Activate Away Mode'}</div>
                      {isAway && <div className="text-lg">💰</div>}
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Contactor Visualization */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Contactor Status</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">24 VAC Active</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Y1 (Cool) Contactor */}
                <div className={`text-center p-4 rounded-lg border-2 ${thermostatState.activeCall === 'Y1' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500' : 'bg-gray-50 dark:bg-gray-700 border-gray-300'}`}>
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${thermostatState.activeCall === 'Y1' ? 'bg-cyan-200 dark:bg-cyan-700 pulse-glow' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`w-6 h-6 rounded-full ${thermostatState.activeCall === 'Y1' ? 'bg-cyan-500' : 'bg-gray-500'}`}></div>
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Y1 (Cool)</div>
                  <div className={`text-xs mt-1 font-bold ${thermostatState.activeCall === 'Y1' ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-500'}`}>
                    {thermostatState.activeCall === 'Y1' ? 'ON' : 'OFF'}
                  </div>
                </div>
                
                {/* W1 (Heat) Contactor */}
                <div className={`text-center p-4 rounded-lg border-2 ${thermostatState.activeCall === 'W1' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500' : 'bg-gray-50 dark:bg-gray-700 border-gray-300'}`}>
                  <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${thermostatState.activeCall === 'W1' ? 'bg-orange-200 dark:bg-orange-700 pulse-glow' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`w-6 h-6 rounded-full ${thermostatState.activeCall === 'W1' ? 'bg-orange-500' : 'bg-gray-500'}`}></div>
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">W1 (Heat)</div>
                  <div className={`text-xs mt-1 font-bold ${thermostatState.activeCall === 'W1' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}`}>
                    {thermostatState.activeCall === 'W1' ? 'ON' : 'OFF'}
                  </div>
                </div>
                
                {/* G (Fan) Contactor */}
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-gray-300">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">G (Fan)</div>
                  <div className="text-xs text-gray-500 mt-1">OFF</div>
                </div>
                
                {/* OB (Reversing Valve) Contactor */}
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-gray-300">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
                  </div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">OB (Rev)</div>
                  <div className="text-xs text-gray-500 mt-1">OFF</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Assistant Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:sticky lg:top-4">
              {/* AI Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center float">
                    <span className="text-xl">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">Ask Joule</h3>
                    <p className="text-xs text-gray-500">AI-powered assistant</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    Natural language commands, what-if scenarios, and insights
                  </p>
                </div>
              </div>

              {/* Quick Suggestions */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Try asking:</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      setAiInput("what's the status?");
                      setTimeout(() => handleAiSubmit(), 50);
                    }}
                    className="w-full text-left p-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/40 dark:hover:to-blue-700/40 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-all"
                  >
                    💡 "What's the status?"
                  </button>
                  <button 
                    onClick={() => {
                      setAiInput("set to 68");
                      setTimeout(() => handleAiSubmit(), 50);
                    }}
                    className="w-full text-left p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/40 dark:hover:to-purple-700/40 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-all"
                  >
                    🌡️ "Set to 68"
                  </button>
                  <button 
                    onClick={() => {
                      setAiInput(isAway ? "I'm home" : "away mode");
                      setTimeout(() => handleAiSubmit(), 50);
                    }}
                    className="w-full text-left p-3 bg-gradient-to-r from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-800/30 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800/40 dark:hover:to-pink-700/40 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-all"
                  >
                    {isAway ? '🏠 "I\'m home"' : '🚗 "Away mode"'}
                  </button>
                </div>
              </div>

              {/* Voice Controls */}
              <div className="mb-6 flex gap-2">
                <button
                  onClick={toggleMic}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"/>
                  </svg>
                  <span className="text-xs font-medium">{isListening ? 'Listening...' : 'Mic'}</span>
                </button>
                
                <button
                  onClick={toggleSpeech}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                    speechEnabled
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                  title={speechEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    {speechEnabled ? (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span className="text-xs font-medium">{speechEnabled ? 'Voice On' : 'Voice Off'}</span>
                  {isSpeaking && <span className="text-xs">🔊</span>}
                </button>
              </div>

              {/* Status Indicators */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Model</span>
                  </div>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-mono font-semibold">llama-3.1-8b</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Location</span>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Blairsville, GA</span>
                </div>
              </div>

              {/* AI Response Area */}
              {aiResponse && (
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{aiResponse}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-submit Countdown Indicator */}
              {autoSubmitCountdown !== null && (
                <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-yellow-800 dark:text-yellow-300">
                    ⏱️ Auto-sending in {autoSubmitCountdown}s...
                  </span>
                  <button
                    type="button"
                    onClick={clearAutoSubmitTimers}
                    className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Input Area */}
              <form onSubmit={handleAiSubmit} className="relative">
                <textarea 
                  placeholder="💬 Type your question here..." 
                  rows="3"
                  value={aiInput}
                  onChange={(e) => {
                    setAiInput(e.target.value);
                    // Cancel auto-submit if user starts typing
                    if (autoSubmitCountdown !== null) {
                      clearAutoSubmitTimers();
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiSubmit(e);
                    }
                  }}
                  className="w-full p-4 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 dark:bg-gray-700 dark:text-gray-200 transition-all"
                ></textarea>
                <button 
                  type="submit"
                  disabled={!aiInput.trim()}
                  className="absolute bottom-4 right-4 p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                </button>
              </form>

              {/* Help Link */}
              <div className="mt-4 text-center">
                <button 
                  onClick={() => navigate('/ask-joule-help')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                  View command list & user manual
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info Bar */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4">
          <div className="flex items-center justify-between text-sm flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">CPU Temp:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">Offline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">Source:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">Manual</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={() => {
                  try {
                    localStorage.removeItem('hasCompletedOnboarding');
                  } catch {
                    // Ignore localStorage errors
                  }
                  navigate('/cost-forecaster');
                }}
                className="px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all hover:scale-105"
                title="Edit your home details and HVAC settings"
              >
                ⚙️ Edit Home Details
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all hover:scale-105"
              >
                🔍 Comprehensive Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartThermostatDemo;

