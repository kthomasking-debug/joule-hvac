import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, TrendingUp, Calendar, Settings } from 'lucide-react';
import AskJoule from '../components/AskJoule';

/**
 * AI Mode - Simplified, voice-first interface with weather animations
 * This is the "conversational thermostat" dream mode
 */
const AIMode = ({ 
  userSettings = {}, 
  userLocation = null,
  annualEstimate = null,
  recommendations = [],
  onNavigate,
  onSettingChange,
  auditLog = [],
  onUndo,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weatherCondition, setWeatherCondition] = useState('clear'); // clear, cloudy, rain, snow
  const [hvacMode, setHvacMode] = useState('idle'); // idle, heating, cooling
  const [showTempBriefly, setShowTempBriefly] = useState(true);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-hide temperature display after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowTempBriefly(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Determine HVAC mode from current settings and time of year
  useEffect(() => {
    const month = currentTime.getMonth();
    // Winter months (Nov-Mar): heating mode
    if (month >= 10 || month <= 2) {
      setHvacMode(userSettings.winterThermostat > 68 ? 'heating' : 'idle');
    } 
    // Summer months (Jun-Aug): cooling mode
    else if (month >= 5 && month <= 7) {
      setHvacMode(userSettings.summerThermostat < 74 ? 'cooling' : 'idle');
    }
    // Spring/Fall: idle
    else {
      setHvacMode('idle');
    }
  }, [userSettings, currentTime]);

  // Determine weather condition from location data (simplified)
  useEffect(() => {
    if (userLocation?.weather) {
      // In production, you'd get this from actual weather API
      setWeatherCondition('clear');
    }
  }, [userLocation]);

  // Weather background animations (reserved for future weather API integration)
  // Uncomment and use when implementing real-time weather data
  // const _getWeatherAnimation = () => {
  //   switch (weatherCondition) {
  //     case 'rain':
  //       return 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800';
  //     case 'snow':
  //       return 'bg-gradient-to-br from-blue-200 via-blue-300 to-blue-400';
  //     case 'cloudy':
  //       return 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600';
  //     default: // clear
  //       return 'bg-gradient-to-br from-blue-400 via-blue-500 to-purple-500';
  //   }
  // };

  const getTimeOfDayGradient = () => {
    const hour = currentTime.getHours();
    
    // Night (10pm - 5am)
    if (hour >= 22 || hour < 5) {
      return 'from-indigo-900 via-purple-900 to-blue-900';
    }
    // Dawn (5am - 7am)
    if (hour >= 5 && hour < 7) {
      return 'from-orange-300 via-pink-400 to-purple-500';
    }
    // Morning (7am - 11am)
    if (hour >= 7 && hour < 11) {
      return 'from-blue-300 via-cyan-400 to-sky-400';
    }
    // Afternoon (11am - 5pm)
    if (hour >= 11 && hour < 17) {
      return 'from-sky-400 via-blue-400 to-blue-500';
    }
    // Evening (5pm - 7pm)
    if (hour >= 17 && hour < 19) {
      return 'from-orange-400 via-pink-500 to-purple-600';
    }
    // Dusk (7pm - 10pm)
    return 'from-purple-600 via-indigo-700 to-blue-800';
  };

  // Quick stats for glanceable info
  const getQuickStats = () => {
    const stats = [];
    
    if (annualEstimate) {
      stats.push({
        icon: <TrendingUp size={24} />,
        label: 'Est. This Week',
        value: `$${Math.round(annualEstimate.totalCost / 52)}`
      });
    }
    
    if (userSettings.winterThermostat) {
      stats.push({
        icon: <Settings size={24} />,
        label: 'Indoor Temp',
        value: `${userSettings.winterThermostat}°F`
      });
    }
    
    if (userLocation) {
      stats.push({
        icon: <Calendar size={24} />,
        label: 'Location',
        value: userLocation.city
      });
    }

    return stats;
  };

  return (
    <div className={`relative min-h-screen overflow-hidden transition-all duration-1000 bg-gradient-to-br ${getTimeOfDayGradient()}`}>
      {/* HVAC Mode Color Overlay */}
      {hvacMode !== 'idle' && (
        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-2000 ${
            hvacMode === 'heating' ? 'bg-orange-500/10' : 'bg-blue-500/10'
          }`}
          style={{ animation: 'pulse 4s ease-in-out infinite' }}
        />
      )}

      {/* Animated weather overlay */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        {/* Stars at night */}
        {(currentTime.getHours() >= 20 || currentTime.getHours() < 6) && (
          <div className="stars-container">
            {[...Array(100)].map((_, i) => (
              <div
                key={`star-${i}`}
                className="star"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                  opacity: 0.4 + Math.random() * 0.6,
                }}
              />
            ))}
          </div>
        )}

        {/* Ambient floating particles (energy visualization) */}
        <div className="particles-container">
          {[...Array(20)].map((_, i) => (
            <div
              key={`particle-${i}`}
              className={`particle ${
                hvacMode === 'heating' ? 'particle-warm' : 
                hvacMode === 'cooling' ? 'particle-cool' : 'particle-neutral'
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${8 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>

        {weatherCondition === 'rain' && (
          <div className="rain-container">
            {[...Array(50)].map((_, i) => (
              <div
                key={`rain-${i}`}
                className="rain-drop"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`
                }}
              />
            ))}
          </div>
        )}
        {weatherCondition === 'snow' && (
          <div className="snow-container">
            {[...Array(50)].map((_, i) => (
              <div
                key={`snow-${i}`}
                className="snowflake"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`,
                  fontSize: `${10 + Math.random() * 10}px`
                }}
              >
                ❄
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        {/* Current Temperature & HVAC Status (fades out after 5s) */}
        <div 
          className={`text-center mb-4 transition-opacity duration-1000 ${
            showTempBriefly ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {userSettings.winterThermostat && (
            <div className="text-white">
              <div className="text-5xl sm:text-6xl font-light mb-1">
                {userSettings.winterThermostat}°F
              </div>
              <div className="text-sm uppercase tracking-wider opacity-70">
                {hvacMode === 'heating' && '🔥 Heating'}
                {hvacMode === 'cooling' && '❄️ Cooling'}
                {hvacMode === 'idle' && '✓ Comfortable'}
              </div>
            </div>
          )}
        </div>

        {/* Time and Date */}
        <div className="text-center mb-8 text-white">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-light mb-2 drop-shadow-lg">
            {currentTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}
          </h1>
          <p className="text-xl sm:text-2xl opacity-90 font-light">
            {currentTime.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Quick glanceable stats */}
        {getQuickStats().length > 0 && (
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {getQuickStats().map((stat, idx) => (
              <div 
                key={idx}
                className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 text-white border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="opacity-80">{stat.icon}</div>
                  <div>
                    <div className="text-sm opacity-80">{stat.label}</div>
                    <div className="text-2xl font-semibold">{stat.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Centered Ask Joule - The Star of the Show */}
        <div className="w-full max-w-4xl">
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Sparkles className="text-yellow-300 animate-pulse" size={32} />
              <h2 className="text-4xl font-light text-white">Ask Joule</h2>
              <Sparkles className="text-yellow-300 animate-pulse" size={32} />
            </div>
            <p className="text-lg text-white/80">
              Your AI home energy assistant
            </p>
          </div>
          
          {/* Ask Joule Component - Styled for AI Mode */}
          <div className="ai-mode-ask-joule">
            <AskJoule
              onParsed={(parsed) => {
                // Handle parsing - but in AI mode, we might want to auto-navigate
                console.log('AI Mode parsed:', parsed);
              }}
              hasLocation={!!userLocation}
              userSettings={userSettings}
              userLocation={userLocation}
              annualEstimate={annualEstimate}
              recommendations={recommendations}
              onNavigate={onNavigate}
              onSettingChange={onSettingChange}
              auditLog={auditLog}
              onUndo={onUndo}
            />
          </div>
        </div>

        {/* Voice prompt hint */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Volume2 size={16} />
            <span>Voice enabled - Just speak your question</span>
          </div>
          <div className="text-xs">
            Try: "What can I save?" • "My Joule Score" • "Show me the forecast"
          </div>
        </div>

        {/* Quick access to Traditional Mode tools */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 text-white/70 text-sm">
          <button 
            onClick={() => onNavigate('/cost-forecaster')}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/20 transition-all"
          >
            Cost Forecaster
          </button>
          <button 
            onClick={() => onNavigate('/upgrade-roi')}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/20 transition-all"
          >
            Upgrade ROI
          </button>
          <button 
            onClick={() => onNavigate('/thermostat-analyzer')}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/20 transition-all"
          >
            Thermostat Analyzer
          </button>
        </div>
      </div>

      {/* CSS for weather animations */}
      <style>{`
        @keyframes fall {
          to {
            transform: translateY(100vh);
          }
        }

        @keyframes snowfall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }

        @keyframes float {
          0% {
            transform: translateY(100vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-100px) translateX(50px) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.05; }
          50% { opacity: 0.15; }
        }

        .rain-drop {
          position: absolute;
          top: -10px;
          width: 2px;
          height: 20px;
          background: linear-gradient(transparent, rgba(255, 255, 255, 0.6));
          animation: fall linear infinite;
        }

        .snowflake {
          position: absolute;
          top: -20px;
          color: white;
          text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
          animation: snowfall linear infinite;
        }

        .star {
          position: absolute;
          width: 2px;
          height: 2px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
          animation: twinkle ease-in-out infinite;
        }

        .particles-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          bottom: -10px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          animation: float linear infinite;
        }

        .particle-warm {
          background: radial-gradient(circle, rgba(255, 150, 50, 0.8), transparent);
          box-shadow: 0 0 10px rgba(255, 100, 0, 0.6);
        }

        .particle-cool {
          background: radial-gradient(circle, rgba(100, 200, 255, 0.8), transparent);
          box-shadow: 0 0 10px rgba(0, 150, 255, 0.6);
        }

        .particle-neutral {
          background: radial-gradient(circle, rgba(255, 255, 255, 0.5), transparent);
          box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
        }

        .ai-mode-ask-joule {
          /* Enhanced for cinematic voice-first experience */
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
};

export default AIMode;
