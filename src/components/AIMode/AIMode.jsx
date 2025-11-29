import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './AIMode.css';
import { useMode } from '../../contexts/ModeContext';
import { Sunny, Night, Snowy, Rainy } from './WeatherAnimations';
import predictiveControl from '../../utils/weather/predictiveControl';
import AskJoule from '../AskJoule';

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
  return (
    <div className="ai-mode-overlay" aria-hidden={mode !== 'ai'}>
      <div className="ai-mode-bg" />
      <Animation />
      <div className="ai-mode-center">
        <div className="ai-mode-temp" data-testid="aimode-current-temp">{currentTemp}°</div>
        <div className="ai-mode-target" data-testid="aimode-target-temp">Target {targetTemp}°</div>
        {forecastState.loading && <div className="ai-mode-loading">Analyzing forecast...</div>}
        {!forecastState.loading && forecastState.error && (
          <div className="ai-mode-error">Forecast unavailable: {forecastState.error}</div>
        )}
        {!forecastState.loading && recommendation && (
          <div className="ai-mode-recommendation" data-testid="aimode-recommendation">
            Recommendation: {recommendation.action === 'preheat' ? 'Preheat' : recommendation.action === 'precool' ? 'Pre-cool' : recommendation.action}
            {recommendation.leadMinutes ? ` ~${recommendation.leadMinutes} min lead` : ''}
            <span className="ai-mode-reason"> – {recommendation.reason}</span>
          </div>
        )}
      </div>
      <div className="ai-mode-status">AI Mode active – Voice interactions enabled</div>
      {/* Interactive Ask Joule panel */}
      <div className="ai-mode-panel" role="dialog" aria-label="AI Assistant Panel">
        <div className="ai-mode-panel-header">
          <div className="ai-mode-panel-icon">⚡</div>
          <div className="ai-mode-panel-title">
            <h2>Ask Joule</h2>
            <p className="ai-mode-panel-subtitle">Natural language commands, what-if scenarios, and insights</p>
          </div>
        </div>
        <div className="ai-mode-panel-content">
          <AskJoule hasLocation disabled={false} tts={ttsPref} groqKey={groqKey} isModal />
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link 
              to="/ask-joule-help" 
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              onClick={() => {
                try { localStorage.setItem('askJouleAiMode', 'off'); } catch {
                  // Ignore localStorage errors
                }
                setMode('traditional');
              }}
            >
              📖 View command list & user manual
            </Link>
          </div>
        </div>
        <button
          className="ai-mode-exit-btn"
          type="button"
          onClick={() => {
            try { localStorage.setItem('askJouleAiMode', 'off'); } catch {
              // Ignore localStorage errors
            }
            setMode('traditional');
          }}
          aria-label="Exit AI Mode"
        >×</button>
      </div>
    </div>
  );
}

// Optional export for importing directory
export default AIMode;
