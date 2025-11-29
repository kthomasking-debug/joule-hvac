import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import './AIMode.css';
import { useMode } from '../../contexts/ModeContext';
import { Sunny, Night, Snowy, Rainy } from './WeatherAnimations';
import predictiveControl from '../../utils/weather/predictiveControl';
import AskJoule from '../AskJoule';
import { Zap, Clock, Settings, Send, Mic, ChevronDown, ChevronUp, Lightbulb, Home, HelpCircle, DollarSign, Star, Sparkles, X } from 'lucide-react';

// Minimal AIMode overlay (non-interactive background + temperature placeholder)
export function AIMode() {
  const { mode, setMode } = useMode();
  // Temperature values would come from thermostat hook later; stub shown
  const [currentTemp] = useState(72);
  const [targetTemp] = useState(() => {
    if (typeof window === 'undefined') return 72;
    try {
      const raw = localStorage.getItem('thermostatState');
      if (raw) {
        const obj = JSON.parse(raw);
        if (typeof obj.targetTemp === 'number') return obj.targetTemp;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 72;
  });
  const [forecastState, setForecastState] = useState({ loading: true });
  const [recommendation, setRecommendation] = useState(null);
  const [condition, setCondition] = useState('sunny');

  // Derive user coordinates if stored; fallback (Denver)
  const coords = useMemo(() => {
    if (typeof window === 'undefined') return { lat: 39.7392, lon: -104.9903 };
    try {
      const lat = parseFloat(localStorage.getItem('userLat'));
      const lon = parseFloat(localStorage.getItem('userLon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    } catch {
      // Ignore localStorage errors
    }
    return { lat: 39.7392, lon: -104.9903 };
  }, []);

  useEffect(() => {
    if (mode !== 'ai') return; // Only fetch when AI mode visible
    try { localStorage.setItem('askJouleAiMode', 'on'); } catch {
      // Ignore localStorage errors
    }
    let active = true;
    (async () => {
      setForecastState({ loading: true });
      const res = await predictiveControl(coords.lat, coords.lon, currentTemp, targetTemp);
      if (!active) return;
      if (res.error) {
        setForecastState({ loading: false, error: res.error });
        return;
      }
      setForecastState({ loading: false, temps: res.outdoorTemps });
      setRecommendation(res.recommendation || null);
      // Condition heuristic using first temp + time of day
      const first = Array.isArray(res.outdoorTemps) ? res.outdoorTemps[0] : null;
      const hour = new Date().getHours();
      let cond = 'sunny';
      if (hour < 6 || hour > 21) cond = 'night';
      else if (typeof first === 'number' && first <= 32) cond = 'snowy';
      else if (typeof first === 'number' && first < 50) cond = 'rainy'; // cool/damp look
      setCondition(cond);
    })();
    return () => { active = false; };
  }, [mode, coords.lat, coords.lon, currentTemp, targetTemp]);

  const Animation = condition === 'night' ? Night : condition === 'snowy' ? Snowy : condition === 'rainy' ? Rainy : Sunny;
  const ttsPref = typeof window !== 'undefined' ? localStorage.getItem('askJouleTts') === 'on' : false;
  const groqKey = typeof window !== 'undefined' ? localStorage.getItem('groqApiKey') || '' : '';
  const groqModel = typeof window !== 'undefined' ? localStorage.getItem('groqModel') || 'llama-3.3-70b-versatile' : 'llama-3.3-70b-versatile';
  
  // Get user location for status bar
  const userLocation = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('userLocation');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Tab state
  const [activeTab, setActiveTab] = useState('chat');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Quick questions with gradient colors
  const quickQuestions = [
    { icon: Lightbulb, text: "My Joule Score", gradient: "from-yellow-500 to-orange-500", emoji: "💡" },
    { icon: Home, text: "How's my system?", gradient: "from-green-500 to-emerald-500", emoji: "🏠" },
    { icon: HelpCircle, text: "Explain HSPF", gradient: "from-purple-500 to-pink-500", emoji: "❓" },
    { icon: DollarSign, text: "Why is my bill high?", gradient: "from-red-500 to-orange-500", emoji: "💰" },
  ];

  // Example questions
  const exampleQuestions = [
    "What can I save?",
    "Where did my heat loss come from?",
    "What's my heat loss factor?",
    "Show me Denver",
    "Set winter to 68",
  ];

  // Handle quick question clicks
  const handleQuickQuestion = (question) => {
    setInputValue(question);
    // Submit directly to AskJoule
    setTimeout(() => {
      handleSubmit(null, question);
    }, 100);
  };

  // Listen for AskJoule responses by polling the output area
  useEffect(() => {
    if (mode !== 'ai') return;
    
    let pollCount = 0;
    const maxPolls = 100; // Maximum 30 seconds (100 * 300ms)
    
    const pollInterval = setInterval(() => {
      pollCount++;
      
      // Check for response text (the actual answer)
      const responseText = document.querySelector('[data-testid="response-text"]');
      if (responseText && responseText.textContent) {
        const text = responseText.textContent.trim();
        if (text && text.length > 0 && text !== outputText && !text.includes('Enter a question')) {
          setOutputText(text);
          setIsLoading(false);
          return;
        }
      }
      
      // Check for error message
      const errorElement = document.querySelector('[data-testid="error-message"]');
      if (errorElement && errorElement.textContent) {
        const text = errorElement.textContent.trim();
        if (text && text.length > 0 && !text.includes('Error:')) {
          setOutputText(`Error: ${text}`);
          setIsLoading(false);
          return;
        }
      }
      
      // Check for loading indicator
      const loadingIndicator = document.querySelector('[data-testid="loading-indicator"]');
      if (loadingIndicator) {
        if (!isLoading) {
          setIsLoading(true);
          setOutputText('Processing your question...');
        }
      }
      
      // Timeout after max polls
      if (pollCount >= maxPolls && isLoading) {
        setOutputText('Request timed out. Please check your Groq API key in Settings and try again.');
        setIsLoading(false);
      }
    }, 300);

    return () => clearInterval(pollInterval);
  }, [mode, outputText, isLoading]);

  // Ref to access AskJoule's input
  const askJouleInputRef = useRef(null);
  
  // Handle input submit
  const handleSubmit = (e, questionText = null) => {
    e?.preventDefault();
    const textToSubmit = questionText || inputValue;
    if (!textToSubmit?.trim()) return;
    
    setIsLoading(true);
    setOutputText('Processing your question...');
    
    // Try multiple methods to trigger AskJoule submit
    // Method 1: Find input by placeholder or any input in the hidden AskJoule area
    const askJouleArea = document.querySelector('.ai-mode-chat-area');
    if (askJouleArea) {
      // Wait a bit for the component to be fully rendered
      setTimeout(() => {
        const askJouleInput = askJouleArea.querySelector('input[type="text"]');
        if (askJouleInput) {
          // Set the value using React's setValue if available, or directly
          askJouleInput.value = textToSubmit;
          askJouleInput.dispatchEvent(new Event('input', { bubbles: true }));
          askJouleInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Find and trigger the form submit
          const form = askJouleInput.closest('form');
          if (form) {
            setTimeout(() => {
              const submitBtn = form.querySelector('button[type="submit"]');
              if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
              } else {
                // Try form.requestSubmit as fallback
                try {
                  form.requestSubmit();
                } catch (err) {
                  // If that fails, dispatch a submit event
                  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
              }
            }, 150);
          }
        } else {
          // If we can't find the input, show an error after a delay
          setTimeout(() => {
            if (isLoading) {
              setOutputText('Error: Could not connect to AskJoule. Please refresh the page.');
              setIsLoading(false);
            }
          }, 2000);
        }
      }, 50);
    } else {
      // If AskJoule area doesn't exist, show error
      setTimeout(() => {
        if (isLoading) {
          setOutputText('Error: AskJoule component not found. Please refresh the page.');
          setIsLoading(false);
        }
      }, 1000);
    }
    
    if (!questionText) {
      setInputValue('');
    }
  };

  return (
    <div className="ai-mode-overlay" aria-hidden={mode !== 'ai'}>
      <div className="ai-mode-bg" />
      <Animation />
      
      {/* New Chat-Style Interface */}
      <div className="ai-mode-panel-new" role="dialog" aria-label="AI Assistant Panel">
        {/* Header with gradient */}
        <div className="ai-mode-header-new">
          <div className="ai-mode-header-overlay"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="ai-mode-header-icon">
                <Zap className="text-white" size={32} />
              </div>
              <div>
                <h1 className="ai-mode-header-title flex items-center gap-2">
                  Ask Joule
                  <Sparkles className="w-6 h-6 text-white" />
                </h1>
                <p className="ai-mode-header-subtitle">Your intelligent home energy assistant</p>
              </div>
            </div>
            <button
              onClick={() => setHeaderCollapsed(!headerCollapsed)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label={headerCollapsed ? "Expand header" : "Collapse header"}
            >
              {headerCollapsed ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>

          {/* Collapsible About */}
          {headerCollapsed && (
            <div className="mt-4 p-4 bg-white/10 backdrop-blur rounded-lg text-sm text-white/90 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-lg">💬</span>
                <p>Ask natural language questions about your heat pump and energy usage</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">🔍</span>
                <p>Run what-if scenarios and get personalized recommendations</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">📊</span>
                <p>Access calculations, analysis tools, and system insights</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="ai-mode-tabs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`ai-mode-tab ${activeTab === 'chat' ? 'ai-mode-tab-active' : ''}`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`ai-mode-tab ${activeTab === 'history' ? 'ai-mode-tab-active' : ''}`}
          >
            <Clock size={20} />
            History
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`ai-mode-tab ${activeTab === 'settings' ? 'ai-mode-tab-active' : ''}`}
          >
            <Settings size={20} />
            Settings
          </button>
        </div>

        {/* Main Content Area */}
        <div className="ai-mode-content-new">
          {activeTab === 'chat' && (
            <>
              {/* Quick Questions Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-slate-400" />
                  <h3 className="ai-mode-section-title">QUICK QUESTIONS</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(q.text)}
                      className="ai-mode-quick-question-btn group relative"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${q.gradient} opacity-0 group-hover:opacity-10 transition-opacity rounded-xl`}></div>
                      <div className="relative flex items-center gap-3">
                        <span className="text-2xl">{q.emoji}</span>
                        <span className="text-white font-medium">{q.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Example Questions Section */}
              <div className="mb-6">
                <h3 className="ai-mode-section-title mb-3">EXAMPLE QUESTIONS</h3>
                <div className="ai-mode-example-container">
                  {exampleQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(question)}
                      className="ai-mode-example-question"
                    >
                      <span className="text-blue-400">•</span>
                      <span>{question}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* System Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="ai-mode-status-card ai-mode-status-online">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-green-300 uppercase">Status</span>
                  </div>
                  <p className="text-white font-bold">System Online</p>
                </div>
                
                <div className="ai-mode-status-card ai-mode-status-model">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-300" />
                    <span className="text-xs font-semibold text-blue-300 uppercase">Model</span>
                  </div>
                  <p className="text-white font-bold text-sm">{groqModel}</p>
                </div>
                
                <div className="ai-mode-status-card ai-mode-status-voice">
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="w-4 h-4 text-purple-300" />
                    <span className="text-xs font-semibold text-purple-300 uppercase">Voice</span>
                  </div>
                  <p className="text-white font-bold">Ready</p>
                </div>
              </div>

              {/* Output Text Box */}
              <div className="mb-6">
                <div className="ai-mode-output-box">
                  {isLoading ? (
                    <div className="flex items-center gap-3 text-slate-300">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                      <span>{outputText || 'Processing your question...'}</span>
                    </div>
                  ) : outputText && !outputText.includes('Enter a question') ? (
                    <div className="text-white whitespace-pre-line text-sm leading-relaxed">
                      {outputText}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="text-lg">💬</span>
                        <p>Enter a question to get started.</p>
                      </div>
                      <div className="flex items-start gap-2 mt-4">
                        <Zap className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-500 italic">
                          Ask me to calculate your balance point
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Messages Area - hidden but functional for AskJoule processing */}
              <div className="ai-mode-chat-area" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden', visibility: 'hidden' }}>
                <AskJoule 
                  hasLocation 
                  disabled={false} 
                  tts={ttsPref} 
                  groqKey={groqKey || ''} 
                  isModal 
                  isVoiceMode={true}
                  userSettings={{}}
                  userLocation={userLocation}
                />
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="ai-mode-history-content">
              <p className="text-gray-400 text-sm">Command history will appear here</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="ai-mode-settings-content">
              <Link 
                to="/settings" 
                className="text-blue-400 hover:text-blue-300 text-sm"
                onClick={() => setMode('traditional')}
              >
                Go to Settings →
              </Link>
            </div>
          )}
        </div>

        {/* Input Bar at Bottom */}
        <div className="ai-mode-input-container">
          <form onSubmit={handleSubmit} className="ai-mode-input-bar">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your heat pump, energy usage, or run scenarios..."
                className="ai-mode-input-field"
                id="ai-mode-main-input"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <button
              type="button"
              className="ai-mode-mic-btn"
              aria-label="Voice input"
              onClick={() => {
                // Trigger voice input - this will be handled by AskJoule
                const event = new CustomEvent('askJouleVoiceToggle');
                window.dispatchEvent(event);
              }}
            >
              <Mic size={24} />
            </button>
            
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="ai-mode-send-btn"
              aria-label="Send message"
            >
              <Send size={24} />
            </button>
          </form>

          {/* Status Bar */}
          <div className="ai-mode-status-bar">
            <div className="flex items-center gap-4">
              <span>{userLocation ? `${userLocation.city || ''}${userLocation.state ? `, ${userLocation.state}` : ''}` : 'Location not set'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3" />
                Ready
              </span>
            </div>
            <button className="hover:text-slate-300 transition-colors text-xs">
              Commands
            </button>
          </div>
        </div>

        {/* Exit Button */}
        <button
          className="ai-mode-exit-btn-new"
          type="button"
          onClick={() => {
            try { localStorage.setItem('askJouleAiMode', 'off'); } catch {}
            setMode('traditional');
          }}
          aria-label="Exit AI Mode"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Optional export for importing directory
export default AIMode;
