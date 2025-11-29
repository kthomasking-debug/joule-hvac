import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Info, Volume2, VolumeX, Mic, MicOff, Zap } from "lucide-react";
import PreferencePanel from "./PreferencePanel";
import LocationSettings from "./LocationSettings";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { parseThermostatCommand } from "../utils/nlp/commandParser";
import { fetchGeocodeCandidates, chooseBestCandidate } from "../utils/geocode";
import { executeCommand } from "../utils/nlp/commandExecutor";
import { resolvePronouns } from "../utils/nlp/contextResolver";
import { parseAskJoule } from "../utils/askJouleParser";
import { useConversationContext } from "../contexts/ConversationContext";
import {
  SuggestedQuestions,
  ActionButtons,
  ConversationExportMenu,
  RandomTip,
} from "./AskJouleEnhancements";
import {
  calculateBalancePoint,
  formatBalancePointResponse,
} from "../utils/balancePointCalculator";
import {
  calculateCharging,
  formatChargingResponse,
  calculatePerformanceMetrics,
  formatPerformanceResponse,
  calculateSetbackSavings,
  formatSetbackResponse,
  compareHeatingSystems,
  formatComparisonResponse,
} from "../utils/calculatorEngines";
import { useProactiveAgent } from "../hooks/useProactiveAgent";
import { answerWithAgent } from "../lib/groqAgent";
import { AgenticResponse } from "../agents/AgenticResponseUI";
import './AskJoule.css';

// Personality-driven response generator
function getPersonalizedResponse(action, data = {}) {
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;
  const isMorning = hour >= 6 && hour < 12;
  const responses = {
    tempUp: [
      `You got it! Setting temperature to ${data.temp}°F.`,
      `Done! Warming things up to ${data.temp}°F.`,
      `${data.temp}°F coming right up!`,
      isNight ? `Cozy! Setting to ${data.temp}°F for the night.` : `Sure thing! ${data.temp}°F it is.`,
    ],
    tempDown: [
      `Cool! Setting temperature to ${data.temp}°F.`,
      `Energy saver mode activated. ${data.temp}°F.`,
      `${data.temp}°F - that'll save you some money!`,
      data.temp < 62 ? `Brrr, that's chilly! ${data.temp}°F set.` : `Got it, ${data.temp}°F.`,
    ],
    sleep: [
      `Good night! Setting sleep temperature to ${data.temp}°F. Sweet dreams!`,
      `Sleep mode activated. ${data.temp}°F will save energy while you rest.`,
      `Perfect for sleeping! ${data.temp}°F set.`,
    ],
    away: [
      `Away mode set to ${data.temp}°F. Have a great trip!`,
      `Eco mode engaged at ${data.temp}°F. I'll watch the house!`,
      `Got it! ${data.temp}°F while you're away. See you soon!`,
    ],
    home: [
      isMorning ? `Welcome back! Setting to comfortable ${data.temp}°F.` : `Home sweet home! ${data.temp}°F.`,
      `Home mode activated at ${data.temp}°F. Good to have you back!`,
      `${data.temp}°F - the perfect homecoming temperature!`,
    ],
    queryTemp: [
      `Current temperature setting is ${data.temp}°F.`,
      `You're at ${data.temp}°F right now.`,
      `${data.temp}°F is your current target.`,
    ],
    highTemp: [
      `Whoa, ${data.temp}°F is pretty toasty! Your energy bill might not like this, but you'll be warm!`,
      `That's hot! ${data.temp}°F set, but keep an eye on your bill.`,
    ],
    lowTemp: [
      `Bundle up! ${data.temp}°F is quite cool, but you'll save on energy.`,
      `Eco warrior! ${data.temp}°F will definitely cut costs.`,
    ],
  };

  const options = responses[action] || [`${action} complete.`];
  const base = options[Math.floor(Math.random() * options.length)];

  // Add warnings for extreme temps
  if (data.temp && data.temp > 78) {
    return responses.highTemp[Math.floor(Math.random() * responses.highTemp.length)];
  }
  if (data.temp && data.temp < 60) {
    return responses.lowTemp[Math.floor(Math.random() * responses.lowTemp.length)];
  }

  return base;
}

// Educational content database
const EDUCATIONAL_CONTENT = {
  hspf: 'HSPF (Heating Seasonal Performance Factor) measures heat pump heating efficiency. Higher is better. Modern systems: 8-11 HSPF2. Each point improvement saves ~10-12% on heating costs.',
  seer: 'SEER (Seasonal Energy Efficiency Ratio) measures cooling efficiency. Modern minimum: 14-15 SEER2. Premium systems: 18-22 SEER2. Each point saves ~5-7% on cooling.',
  cop: 'COP (Coefficient of Performance) is instantaneous efficiency: BTU output ÷ BTU input. Heat pumps typically have COP of 2.5-4.0, meaning 250-400% efficient.',
  hdd: 'HDD (Heating Degree Days) measures heating demand. Sum of daily (65°F - avg temp) when below 65°F. Higher HDD = colder climate, more heating needed.',
  cdd: 'CDD (Cooling Degree Days) measures cooling demand. Sum of daily (avg temp - 65°F) when above 65°F. Higher CDD = hotter climate, more AC needed.',
  insulation: 'Insulation reduces heat transfer. R-value measures resistance. Attic: R-38 to R-60. Walls: R-13 to R-21. Better insulation = smaller system needed + lower bills.',
  auxheat: 'Aux/backup heat activates when outdoor temp drops below heat pump balance point (~25-35°F). Uses expensive resistance strips. Minimize by upgrading to cold-climate HP.',
};

const AskJoule = ({
  onParsed,
  hasLocation,
  disabled,
  isModal,
  onClose,
  tts: ttsProp,
  groqKey: groqKeyProp,
  userSettings = {},
  userLocation = null,
  annualEstimate = null,
  recommendations = [],
  onNavigate = null,
  onSettingChange = null,
  auditLog = [],
  onUndo = null,
}) => {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  // 'success' | 'error' | 'info' | ''
  const [outputStatus, setOutputStatus] = useState('');
  const [showGroqPrompt, setShowGroqPrompt] = useState(false);
  const [isLoadingGroq, setIsLoadingGroq] = useState(false);
  const [lastQuery, setLastQuery] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCommandHelp, setShowCommandHelp] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const inputRef = useRef(null);

  // Additional state variables
  const [answer, setAnswer] = useState('');
  const [agenticResponse, setAgenticResponse] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [briefing, setBriefing] = useState(null);
  const [commandHistory, setCommandHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('askJouleHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const submitRef = useRef(null);

  // Speech recognition will be initialized via useSpeechRecognition hook below

  // Generate context-aware suggestions
  const contextualSuggestions = useMemo(() => {
    const suggestions = [];

    // Personalized based on recommendations
    if (recommendations.length > 0) {
      suggestions.push(`What can I save?`);
      const topRec = recommendations[0];
      if (topRec.savingsEstimate > 200) {
        suggestions.push(`How to save $${Math.round(topRec.savingsEstimate)}/year`);
      }
    }

    // System-specific
    if (userSettings.hspf2 && userSettings.hspf2 < 9) {
      suggestions.push(`What if I had a 10 HSPF system?`);
    }
    if (userSettings.efficiency && userSettings.efficiency < 16) {
      suggestions.push(`What if I had 18 SEER?`);
    }

    // Location-specific
    if (userLocation) {
      suggestions.push(`What's normal for ${userLocation.city}?`);
      suggestions.push(`Show me ${userLocation.city} forecast`);
    }

    // General helpful queries
    suggestions.push(`My Joule Score`);
    suggestions.push(`How's my system?`);
    suggestions.push(`Explain HSPF`);
    suggestions.push(`Why is my bill high?`);
    suggestions.push(`Run analyzer`);
    suggestions.push(`Break-even on $8000 upgrade`);

    return suggestions.slice(0, 8); // Limit to 8
  }, [recommendations, userSettings, userLocation]);

  // Filter suggestions as user types with guards to avoid unnecessary re-renders
  useEffect(() => {
    if (!value.trim()) {
      if (suggestions.length > 0) setSuggestions([]);
      if (showSuggestions) setShowSuggestions(false);
      return;
    }

    const filtered = contextualSuggestions.filter(s =>
      s.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5);

    // Compare arrays shallowly to avoid setting identical arrays which can cause re-renders
    const isSame = filtered.length === suggestions.length && filtered.every((v, i) => v === suggestions[i]);
    if (!isSame) setSuggestions(filtered);

    const shouldShow = filtered.length > 0 && value.length > 2;
    if (shouldShow !== showSuggestions) setShowSuggestions(shouldShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, contextualSuggestions]);

  const placeholder = useMemo(() => {
    if (recommendations && recommendations.length > 0) {
      return 'Try: "What can I save?" or "My score"';
    }
    return 'Try: "2,000 sq ft in Atlanta at 70" or "What is my score?"';
  }, [recommendations]);

  // Handle context-aware commands
  const handleCommand = (parsed) => {
    if (!parsed.isCommand) return false;

    setError('');
    stop(); // Stop any ongoing speech when new command starts

    // Clear status by default; each branch sets to 'success' or 'error'
    switch (parsed.action) {
      case 'increaseTemp': {
        const currentWinter = userSettings.winterThermostat || 68;
        const newTemp = currentWinter + parsed.value;
        if (onSettingChange) {
          onSettingChange('winterThermostat', newTemp, { source: 'AskJoule', comment: `Increased by ${parsed.value}°` });
          const response = getPersonalizedResponse('tempUp', { temp: newTemp, delta: parsed.value });
          setError(response);
          setOutputStatus('success');
          speak(response);
        }
        return true;
      }

      case 'decreaseTemp': {
        const currentWinter = userSettings.winterThermostat || 68;
        const newTemp = currentWinter - parsed.value;
        if (onSettingChange) {
          onSettingChange('winterThermostat', newTemp, { source: 'AskJoule', comment: `Decreased by ${parsed.value}°` });
          const response = getPersonalizedResponse('tempDown', { temp: newTemp, delta: parsed.value });
          setError(response);
          setOutputStatus('success');
          speak(response);
        }
        return true;
      }

      case 'presetSleep': {
        const sleepTemp = 65;
        if (onSettingChange) {
          onSettingChange('winterThermostat', sleepTemp, { source: 'AskJoule', comment: 'Sleep mode preset' });
          const response = getPersonalizedResponse('sleep', { temp: sleepTemp });
          setError(response);
          setOutputStatus('success');
          speak(response);
        }
        return true;
      }

      case 'presetAway': {
        const awayTemp = 60;
        if (onSettingChange) {
          onSettingChange('winterThermostat', awayTemp, { source: 'AskJoule', comment: 'Away mode preset' });
          const response = getPersonalizedResponse('away', { temp: awayTemp });
          setError(response);
          setOutputStatus('success');
          speak(response);
        }
        return true;
      }

      case 'presetHome': {
        const homeTemp = 70;
        if (onSettingChange) {
          onSettingChange('winterThermostat', homeTemp, { source: 'AskJoule', comment: 'Home mode preset' });
          const response = getPersonalizedResponse('home', { temp: homeTemp });
          setError(response);
          setOutputStatus('success');
          speak(response);
        }
        return true;
      }

      case 'queryTemp': {
        const temp = userSettings.winterThermostat || 68;
        const response = getPersonalizedResponse('queryTemp', { temp });
        setError(response);
        setOutputStatus('info');
        speak(response);
        return true;
      }

      case 'setWinterTemp':
        if (onSettingChange) {
          onSettingChange('winterThermostat', parsed.value, { source: 'AskJoule', comment: 'Set winter thermostat via Ask Joule' });
          setError(`✓ Winter thermostat set to ${parsed.value}°F`);
          setOutputStatus('success');
        } else {
          setError(`I would set winter to ${parsed.value}°F, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setSummerTemp':
        if (onSettingChange) {
          onSettingChange('summerThermostat', parsed.value, { source: 'AskJoule', comment: 'Set summer thermostat via Ask Joule' });
          setError(`✓ Summer thermostat set to ${parsed.value}°F`);
          setOutputStatus('success');
        } else {
          setError(`I would set summer to ${parsed.value}°F, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'navigate': {
        const routes = {
          forecast: '/cost-forecaster',
          comparison: '/cost-comparison',
          balance: '/energy-flow',
          charging: '/charging-calculator',
          analyzer: '/performance-analyzer',
          methodology: '/methodology',
          settings: '/settings',
          thermostat: '/thermostat-analyzer',
          budget: '/monthly-budget',
          roi: '/upgrade-roi'
        };

        const labels = {
          forecast: '7-Day Cost Forecaster',
          comparison: 'System Comparison',
          balance: 'Balance Point Analyzer',
          charging: 'A/C Charging Calculator',
          analyzer: 'Performance Analyzer',
          methodology: 'Calculation Methodology',
          settings: 'Settings',
          thermostat: 'Thermostat Strategy Analyzer',
          budget: 'Monthly Budget Planner',
          roi: 'Upgrade ROI Analyzer'
        };

        if (parsed.cityName) {
          // Store city for forecast page to use
          try {
            localStorage.setItem('askJoule_targetCity', parsed.cityName);
          } catch {
            // ignore storage errors
          }
        }

        const path = routes[parsed.target];
        const label = labels[parsed.target];

        if (path) {
          if (onNavigate) {
            onNavigate(path);
          } else {
            navigate(path);
          }
          setError(`Opening ${label}...`);
          setOutputStatus('success');
          speak(`Opening ${label}`);
        } else {
          setError('Navigation target not recognized.');
          setOutputStatus('error');
        }
        return true;
      }

      case 'showSavings':
        if (recommendations.length > 0) {
          const topRec = recommendations[0];
          setError(`💡 ${topRec.title}: ${topRec.message}`);
          setOutputStatus('info');
        } else {
          setError(`Great news! Your system is already well-optimized. Check Settings for minor improvements.`);
          setOutputStatus('info');
        }
        return true;

      case 'showScore':
        if (userSettings.hspf2 && userSettings.efficiency) {
          const hspf = Number(userSettings.hspf2) || 9;
          const seer = Number(userSettings.efficiency) || 15;
          const score = Math.max(1, Math.min(100, 70 + (hspf - 8) * 2 + (seer - 14) * 1.2));
          setError(`🎯 Your Joule Score: ${Math.round(score)}/100 (HSPF: ${hspf.toFixed(1)}, SEER: ${seer.toFixed(1)})`);
          setOutputStatus('success');
        } else {
          setError(`Complete your system settings to see your Joule Score!`);
          setOutputStatus('info');
        }
        return true;

      case 'systemStatus':
        if (userSettings.hspf2 && annualEstimate) {
          const status = [];
          status.push(`System: ${userSettings.hspf2} HSPF2 / ${userSettings.efficiency} SEER2`);
          status.push(`Annual cost: $${Math.round(annualEstimate.totalCost)}`);
          if (recommendations.length > 0) {
            status.push(`💡 ${recommendations.length} improvement(s) available`);
          }
          setError(status.join(' • '));
          setOutputStatus('info');
        } else {
          setError(`Set your location and system details to see status.`);
        }
        return true;

      case 'whatIfHSPF':
        if (annualEstimate && userSettings.hspf2) {
          const currentHSPF = Number(userSettings.hspf2) || 9;
          const newHSPF = parsed.value;
          const improvementRatio = newHSPF / currentHSPF;
          const currentHeating = annualEstimate.heatingCost || 0;
          const newCost = currentHeating / improvementRatio;
          const savings = currentHeating - newCost;
          setError(`With ${newHSPF} HSPF2: Heating cost would be $${Math.round(newCost)}/year (save $${Math.round(savings)})`);
          setOutputStatus('info');
        } else {
          setError(`Set your location and current HSPF2 to calculate what-if scenarios.`);
          setOutputStatus('info');
        }
        return true;

      case 'whatIfSEER':
        if (annualEstimate && userSettings.efficiency) {
          const currentSEER = Number(userSettings.efficiency) || 15;
          const newSEER = parsed.value;
          const improvementRatio = newSEER / currentSEER;
          const currentCooling = annualEstimate.coolingCost || 0;
          const newCost = currentCooling / improvementRatio;
          const savings = currentCooling - newCost;
          setError(`With ${newSEER} SEER2: Cooling cost would be $${Math.round(newCost)}/year (save $${Math.round(savings)})`);
          setOutputStatus('info');
        } else {
          setError(`Set your location and current SEER2 to calculate what-if scenarios.`);
          setOutputStatus('info');
        }
        return true;

      case 'setHSPF':
        if (onSettingChange) {
          onSettingChange('hspf2', parsed.value, { source: 'AskJoule', comment: 'Set HSPF via Ask Joule' });
          setError(`✓ HSPF set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set HSPF to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setSEER':
        if (onSettingChange) {
          onSettingChange('efficiency', parsed.value, { source: 'AskJoule', comment: 'Set SEER via Ask Joule' });
          setError(`✓ SEER set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set SEER to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setUtilityCost':
        if (onSettingChange) {
          onSettingChange('utilityCost', parsed.value, { source: 'AskJoule', comment: 'Set utility cost via Ask Joule' });
          setError(`✓ Utility cost set to $${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set utility cost to $${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setLocation': {
        if (parsed.cityName) {
          try {
            // Store as askJoule_targetCity for other parts of app to consume
            localStorage.setItem('askJoule_targetCity', parsed.cityName);
            // store a lightweight userLocation entry in localStorage for immediate UX use
            try {
              const oldRaw = localStorage.getItem('userLocation');
              const oldLoc = oldRaw ? JSON.parse(oldRaw) : null;
              const newLoc = { ...(oldLoc || {}), city: parsed.cityName };
              localStorage.setItem('userLocation', JSON.stringify(newLoc));
            } catch (err) { console.debug('Ignoring error setting interim userLocation:', err); }
          } catch (err) { console.debug('Failed to set userLocation in localStorage', err); }
          if (onSettingChange) {
            try { onSettingChange('location', parsed.cityName, { source: 'AskJoule', comment: 'Set location via Ask Joule' }); } catch (err) { console.debug('Failed onSettingChange for location', err); }
          }
          setError(`✓ Location updated to ${parsed.cityName}`);
          setOutputStatus('success');
          // Navigate to forecast to reflect change
          if (onNavigate) onNavigate('/cost-forecaster'); else navigate('/cost-forecaster');
          return true;
        }
        return false;
      }
      case 'setSquareFeet':
        if (onSettingChange) {
          onSettingChange('squareFeet', parsed.value, { source: 'AskJoule', comment: 'Set square feet via Ask Joule' });
          setError(`✓ Home size set to ${parsed.value} sq ft`);
          setOutputStatus('success');
        } else {
          setError(`I would set square footage to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setInsulationLevel':
        if (onSettingChange) {
          onSettingChange('insulationLevel', parsed.value, { source: 'AskJoule', comment: 'Set insulation via Ask Joule' });
          setError(`✓ Insulation: ${parsed.raw || parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set insulation to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setCapacity':
        if (onSettingChange) {
          onSettingChange('capacity', parsed.value, { source: 'AskJoule', comment: 'Set capacity via Ask Joule' });
          onSettingChange('coolingCapacity', parsed.value, { source: 'AskJoule', comment: 'Set cooling capacity via Ask Joule' });
          setError(`✓ Capacity set to ${parsed.value}k BTU`);
          setOutputStatus('success');
        } else {
          setError(`I would set capacity to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setAFUE':
        if (onSettingChange) {
          onSettingChange('afue', parsed.value, { source: 'AskJoule', comment: 'Set AFUE via Ask Joule' });
          setError(`✓ AFUE set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set AFUE to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setCeilingHeight':
        if (onSettingChange) {
          onSettingChange('ceilingHeight', parsed.value, { source: 'AskJoule', comment: 'Set ceiling height via Ask Joule' });
          setError(`✓ Ceiling height set to ${parsed.value} ft`);
          setOutputStatus('success');
        } else {
          setError(`I would set ceiling height to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setHomeElevation':
        if (onSettingChange) {
          onSettingChange('homeElevation', parsed.value, { source: 'AskJoule', comment: 'Set home elevation via Ask Joule' });
          setError(`✓ Home elevation set to ${parsed.value} ft`);
          setOutputStatus('success');
        } else {
          setError(`I would set home elevation to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setUseElectricAuxHeat':
        if (onSettingChange) {
          onSettingChange('useElectricAuxHeat', parsed.value, { source: 'AskJoule', comment: 'Set aux heat preference via Ask Joule' });
          setError(parsed.value ? '✓ Using electric aux heat enabled' : '✓ Using electric aux heat disabled');
          setOutputStatus('success');
        } else {
          setError('I would toggle electric aux heat, but settings updates are not connected.');
          setOutputStatus('error');
        }
        return true;

      case 'setHomeShape':
        if (onSettingChange) {
          onSettingChange('homeShape', parsed.value, { source: 'AskJoule', comment: 'Set home shape via Ask Joule' });
          setError(`✓ Home shape set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set home shape to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setSolarExposure':
        if (onSettingChange) {
          onSettingChange('solarExposure', parsed.value, { source: 'AskJoule', comment: 'Set solar exposure via Ask Joule' });
          setError(`✓ Solar exposure set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set solar exposure to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setEnergyMode':
        if (onSettingChange) {
          onSettingChange('energyMode', parsed.value, { source: 'AskJoule', comment: 'Set energy mode via Ask Joule' });
          setError(`✓ Energy mode set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set energy mode to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setPrimarySystem':
        if (onSettingChange) {
          onSettingChange('primarySystem', parsed.value, { source: 'AskJoule', comment: 'Set primary system via Ask Joule' });
          setError(`✓ Primary system set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set primary system to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setGasCost':
        if (onSettingChange) {
          onSettingChange('gasCost', parsed.value, { source: 'AskJoule', comment: 'Set gas cost via Ask Joule' });
          setError(`✓ Gas cost set to $${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set gas cost to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'setCoolingSystem':
        if (onSettingChange) {
          onSettingChange('coolingSystem', parsed.value, { source: 'AskJoule', comment: 'Set cooling system via Ask Joule' });
          setError(`✓ Cooling system set to ${parsed.value}`);
          setOutputStatus('success');
        } else {
          setError(`I would set cooling system to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;
      case 'setCoolingCapacity':
        if (onSettingChange) {
          onSettingChange('coolingCapacity', parsed.value, { source: 'AskJoule', comment: 'Set cooling capacity via Ask Joule' });
          setError(`✓ Cooling capacity set to ${parsed.value}k BTU`);
          setOutputStatus('success');
        } else {
          setError(`I would set cooling capacity to ${parsed.value}, but settings updates aren't connected.`);
          setOutputStatus('error');
        }
        return true;

      case 'undo':
        if (typeof onUndo === 'function') {
          const success = onUndo(parsed.when || 'last');
          setError(success ? '✓ Undid last change' : 'No change to undo.');
          setOutputStatus(success ? 'success' : 'error');
        } else {
          setError('I would undo the last change, but undo is not available here.');
          setOutputStatus('error');
        }
        return true;

      case 'breakEven':
        if (annualEstimate && recommendations.length > 0) {
          const totalSavings = recommendations.reduce((sum, r) => sum + (r.savingsEstimate || 0), 0);
          const years = parsed.cost / totalSavings;
          setError(`With $${parsed.cost.toLocaleString()} upgrade saving $${Math.round(totalSavings)}/year: Break-even in ${years.toFixed(1)} years`);
          setOutputStatus('info');
        } else {
          setError(`Set your location and system details to calculate payback period.`);
        }
        return true;

      case 'showHelp':
        setError(`🔍 **Ask Joule Capabilities**

**Questions I can answer:**
• "What can I save?" - Show recommendations
• "How's my system?" - System summary
• "Why is my bill high?" - Analyze factors
• "What is HSPF/SEER?" - Learn terms

**Navigate to tools:**
• "forecast" - 7-Day Cost Forecaster
• "compare" - Heat pump vs gas
• "balance" - Energy flow viz
• "charging" - A/C calculator
• "analyzer" - Performance tool
• "methodology" - Math formulas
• "settings" - Preferences
• "thermostat" - Setback analysis
• "budget" - Monthly planner
• "upgrade" - ROI calculator

**Change settings:**
• "Set winter to 68"
• "Set HSPF to 10"
• "Set cost to $0.12"
• "Set 2000 sq ft"

Try: "show forecast" or "compare"!`);
        setOutputStatus('info');
        speak('I can navigate to any tool, answer questions, or change settings.');
        return true;

      case 'educate': {
        const content = EDUCATIONAL_CONTENT[parsed.topic];
        if (content) {
          setError(`ℹ️ ${content}`);
          setOutputStatus('info');
        } else {
          setError(`I don't have info on that topic yet. Try: HSPF, SEER, COP, HDD, CDD, insulation, or aux heat.`);
          setOutputStatus('info');
        }
        return true;
      }

      case 'explainBill':
        if (annualEstimate && userLocation) {
          const reasons = [];
          if (annualEstimate.hdd > 5000) reasons.push(`cold climate (${annualEstimate.hdd} HDD)`);
          if (annualEstimate.cdd > 2000) reasons.push(`hot climate (${annualEstimate.cdd} CDD)`);
          if (userSettings.hspf2 < 9) reasons.push(`low HSPF2 (${userSettings.hspf2})`);
          if (userSettings.insulationLevel > 1.1) reasons.push(`poor insulation`);
          if (annualEstimate.auxKwhIncluded > 1000) reasons.push(`high aux heat usage`);

          if (reasons.length > 0) {
            setError(`💡 Bill factors: ${reasons.join(', ')}. See recommendations for fixes!`);
            setOutputStatus('info');
          } else {
            setError(`Your costs look normal for ${userLocation.city}. Annual: $${Math.round(annualEstimate.totalCost)}`);
            setOutputStatus('info');
          }
        } else {
          setError(`Set your location to analyze your bill.`);
        }
        return true;

      case 'normalForCity':
        // Would need HDD/CDD lookup - simplified version
        setError(`For ${parsed.cityName}: typical HSPF 9-10, SEER 15-16. Check Cost Forecaster for detailed analysis.`);
        setOutputStatus('info');
        return true;

      case 'showDiagnostics': {
        try {
          const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
          if (!diagnostics || !diagnostics.issues || diagnostics.issues.length === 0) {
            setError(`✅ No system issues detected. Upload thermostat data in the Performance Analyzer to check your system.`);
            setOutputStatus('info');
            speak('No system issues detected');
          } else {
            const summary = diagnostics.summary;
            const issueList = diagnostics.issues.slice(0, 3).map(i => `• ${i.description}`).join('\n');
            const more = diagnostics.issues.length > 3 ? `\n... and ${diagnostics.issues.length - 3} more issues` : '';
            setError(`⚠️ **System Diagnostics**\n\nFound ${summary.totalIssues} issue(s):\n${issueList}${more}\n\nView Performance Analyzer for details.`);
            setOutputStatus('warning');
            speak(`Found ${summary.totalIssues} system issues. Check the performance analyzer for details.`);
          }
        } catch {
          setError(`No diagnostic data available. Upload thermostat CSV in Performance Analyzer first.`);
          setOutputStatus('info');
        }
        return true;
      }

      case 'checkShortCycling': {
        try {
          const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
          const shortCycling = diagnostics?.issues?.find(i => i.type === 'short_cycling');
          if (shortCycling) {
            setError(`⚠️ ${shortCycling.description}\n\nShort cycling reduces efficiency and can damage your compressor. Consider checking: refrigerant levels, thermostat placement, or filter cleanliness.`);
            setOutputStatus('warning');
            speak('Short cycling detected. This can damage your compressor.');
          } else {
            setError(`✅ No short cycling detected in your thermostat data.`);
            setOutputStatus('success');
            speak('No short cycling detected');
          }
        } catch {
          setError(`Upload thermostat CSV data in Performance Analyzer to check for short cycling.`);
          setOutputStatus('info');
        }
        return true;
      }

      case 'showCsvInfo': {
        try {
          const filename = localStorage.getItem('spa_filename');
          const timestamp = localStorage.getItem('spa_uploadTimestamp');
          const data = JSON.parse(localStorage.getItem('spa_parsedCsvData') || 'null');
          if (data && data.length > 0) {
            const uploaded = timestamp ? new Date(timestamp).toLocaleDateString() : 'recently';
            setError(`📊 **Thermostat Data**\n\nFile: ${filename || 'thermostat-data.csv'}\nUploaded: ${uploaded}\nData points: ${data.length}\n\nAsk me about problems, short cycling, or aux heat usage!`);
            setOutputStatus('info');
            speak(`You have ${data.length} data points uploaded on ${uploaded}`);
          } else {
            setError(`No thermostat data uploaded yet. Visit Performance Analyzer to upload CSV data.`);
            setOutputStatus('info');
          }
        } catch {
          setError(`No CSV data found. Upload in Performance Analyzer first.`);
          setOutputStatus('info');
        }
        return true;
      }

      case 'checkAuxHeat': {
        try {
          const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
          const auxHeat = diagnostics?.issues?.find(i => i.type === 'excessive_aux_heat');
          if (auxHeat) {
            setError(`⚠️ ${auxHeat.description}\n\nAux heat (${auxHeat.details?.auxPercentage}% of runtime) is expensive! Check your balance point setting or thermostat configuration.`);
            setOutputStatus('warning');
            speak('Excessive auxiliary heat usage detected');
          } else {
            setError(`✅ Auxiliary heat usage is within normal range.`);
            setOutputStatus('success');
            speak('Auxiliary heat usage is normal');
          }
        } catch {
          setError(`Upload thermostat data to analyze aux heat usage.`);
          setOutputStatus('info');
        }
        return true;
      }

      case 'checkTempStability': {
        try {
          const diagnostics = JSON.parse(localStorage.getItem('spa_diagnostics') || 'null');
          const tempStability = diagnostics?.issues?.find(i => i.type === 'temperature_instability');
          if (tempStability) {
            setError(`⚠️ ${tempStability.description}\n\nLarge temperature swings may indicate thermostat issues, poor insulation, or undersized equipment.`);
            setOutputStatus('warning');
            speak('Temperature instability detected');
          } else {
            setError(`✅ Indoor temperature stability looks good.`);
            setOutputStatus('success');
            speak('Temperature stability is normal');
          }
        } catch {
          setError(`Upload thermostat data to analyze temperature stability.`);
          setOutputStatus('info');
        }
        return true;
      }

      default:
        // Unknown command; report error to user
        setError(`❌ Sorry, I didn't recognize that command.`);
        setOutputStatus('error');
        return false;
    }
  };

  // Agentic AI mode toggle
  const [agenticMode, setAgenticMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("askJouleAgenticMode") === "on";
  });

  // AI Mode: when enabled and Groq key present, auto-fallback without prompt
  const [aiMode, setAiMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("askJouleAiMode") === "on";
  });
  // Text To Speech toggle
  const [ttsOn, setTtsOn] = useState(() => {
    if (typeof window === "undefined") return false;
    if (typeof ttsProp === "boolean") return ttsProp;
    return localStorage.getItem("askJouleTts") === "on";
  });

  // Save command to history
  const saveToHistory = (command) => {
    if (!command || !command.trim()) return;
    setCommandHistory((prev) => {
      const updated = [command, ...prev.filter((c) => c !== command)].slice(
        0,
        50
      ); // Keep last 50, no duplicates
      try {
        localStorage.setItem("askJouleHistory", JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors (e.g., quota exceeded)
      }
      return updated;
    });
    setHistoryIndex(-1);
  };

  // Keyboard navigation for command history
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target !== inputRef.current) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        // Start at 0 (most recent) if not browsing, otherwise go to older commands
        const newIndex =
          historyIndex < commandHistory.length - 1
            ? historyIndex + 1
            : commandHistory.length - 1;
        setHistoryIndex(newIndex);
        setValue(commandHistory[newIndex] || "");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex <= 0) {
          // Go back to empty input
          setHistoryIndex(-1);
          setValue("");
        } else {
          // Go to more recent command
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setValue(commandHistory[newIndex] || "");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        setHistoryIndex(-1);
        setError("");
        setAnswer("");
        setAgenticResponse(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandHistory, historyIndex]);
  const {
    supported: recognitionSupported,
    isListening: isListeningToVoice,
    transcript,
    error: speechError,
    restartCount,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    interim: true,
    continuous: true,
    autoRestart: true,
    maxAutoRestarts: 8,
    autoStopOnFinal: true,
    onInterim: (chunk) => {
      setValue((prev) => {
        if (prev && !prev.endsWith(chunk)) return prev;
        return transcript || chunk;
      });
    },
    onFinal: (finalText) => {
      if (!finalText) return;
      setValue(finalText);
      // Submit shortly after finalization
      setTimeout(() => {
        try {
          if (submitRef.current)
            submitRef.current({ preventDefault: () => { } });
        } catch {
          /* ignore submit failure */
        }
      }, 160);
    },
  });

  // Aliases for backward compatibility
  const speechSupported = recognitionSupported;
  const isListening = isListeningToVoice;

  // Update input live while listening (interim transcript)
  React.useEffect(() => {
    if (isListening && transcript) setValue(transcript);
  }, [isListening, transcript]);

  function toggleRecording() {
    if (!speechSupported) return;
    if (isListening) stopListening();
    else startListening();
  }

  const toggleListening = toggleRecording;

  // Enhanced TTS hook (queue + personality)
  const { speak, speakImmediate, cancel, isEnabled: speechEnabled, isSpeaking, toggleEnabled: toggleSpeech } = useSpeechSynthesis({
    enabled: ttsOn,
    personality: "friendly",
  });

  // Alias for backward compatibility
  const stop = cancel;
  // Get Groq API key & model from localStorage (or props)
  const groqApiKey =
    typeof groqKeyProp === "string" && groqKeyProp
      ? groqKeyProp
      : typeof window !== "undefined"
        ? (localStorage.getItem("groqApiKey") || "").trim()
        : "";
  const groqModel =
    typeof window !== "undefined"
      ? localStorage.getItem("groqModel") || "llama-3.1-8b-instant"
      : "llama-3.1-8b-instant";

  const userLocationFromStorage = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("userLocation");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Use prop if provided, otherwise fall back to localStorage
  const _effectiveUserLocation = userLocation || userLocationFromStorage;

  const { history, addInteraction } = useConversationContext();

  // Load user settings from localStorage (reactive to changes)
  // Merge with prop if provided
  const [localUserSettings, setLocalUserSettings] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("userSettings");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Merge prop and local settings (prop takes precedence)
  const _effectiveUserSettings = useMemo(() => {
    return { ...localUserSettings, ...userSettings };
  }, [localUserSettings, userSettings]);

  // Update userSettings when localStorage changes (e.g., from Settings page)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem("userSettings");
        const updated = raw ? JSON.parse(raw) : {};
        // Include groqKey prop if provided
        if (groqKeyProp) {
          updated.groqKey = groqKeyProp;
        }
        // Also check for groqApiKey in localStorage (for test environment)
        const apiKey = localStorage.getItem("groqApiKey");
        if (apiKey && !updated.groqKey) {
          updated.groqKey = apiKey.trim();
        }
        setLocalUserSettings(updated);
      } catch {
        setLocalUserSettings({});
      }
    };

    // Listen for storage events
    window.addEventListener("storage", handleStorageChange);

    // Also check on mount in case it changed
    handleStorageChange();

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [groqKeyProp]);

  // Track execution progress for advanced mode
  const [executionProgress, setExecutionProgress] = useState([]);
  const [isAgenticProcessing, setIsAgenticProcessing] = useState(false);

  // Get thermostat data for proactive agent
  const thermostatDataForProactive = useMemo(() => {
    try {
      const stored = localStorage.getItem("thermostatCSVData");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Initialize Proactive Agent features
  // Note: The hook uses refs internally to avoid infinite loops from changing object references
  const {
    alerts: proactiveAlerts,
    briefing: dailyBriefingFromHook,
    hasAlerts,
    checkAlerts,
    getBriefing,
  } = useProactiveAgent(thermostatDataForProactive, _effectiveUserSettings);

  // Sync briefing from hook to local state
  useEffect(() => {
    if (dailyBriefingFromHook) {
      setBriefing(dailyBriefingFromHook);
    }
  }, [dailyBriefingFromHook]);

  // Execute commands that modify settings or navigate
  const executeAskJouleCommand = async (command) => {
    if (!command) return null;

    const { action, value, target } = command;

    // Agentic Multi-Tool Commands
    if (action === "fullAnalysis") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const location = JSON.parse(
          localStorage.getItem("userLocation") || "{}"
        );

        const parts = [];
        if (location.city) parts.push(`Location: ${location.city}`);
        if (userSettings.squareFeet)
          parts.push(`${userSettings.squareFeet.toLocaleString()} sq ft`);
        if (userSettings.seer2) parts.push(`SEER ${userSettings.seer2}`);
        if (userSettings.hspf2) parts.push(`HSPF ${userSettings.hspf2}`);
        if (userSettings.winterThermostat)
          parts.push(`Winter: ${userSettings.winterThermostat}°F`);
        if (userSettings.summerThermostat)
          parts.push(`Summer: ${userSettings.summerThermostat}°F`);

        return `System Overview: ${parts.join(
          " • "
        )}. Visit the forecast page for detailed cost analysis.`;
      } catch {
        return "Visit the forecast page to see your full system analysis.";
      }
    }

    if (action === "systemAnalysis") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const efficiency = [];
        if (userSettings.seer2) efficiency.push(`SEER ${userSettings.seer2}`);
        if (userSettings.hspf2) efficiency.push(`HSPF ${userSettings.hspf2}`);
        const insul = userSettings.insulationLevel
          ? ` with ${userSettings.insulationLevel} insulation`
          : "";

        return `Your system: ${efficiency.join(
          ", "
        )}${insul}. Check the performance analyzer for detailed metrics.`;
      } catch {
        return "Check the performance analyzer page for system details.";
      }
    }

    if (action === "costForecast") {
      return "Visit the 7-day cost forecaster to see your upcoming heating and cooling costs based on weather predictions.";
    }

    if (action === "savingsAnalysis") {
      return "Check the system comparison page to see potential savings from upgrading your HVAC system.";
    }

    // Balance point calculation
    if (action === "calculateBalancePoint") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const result = calculateBalancePoint(userSettings);
        return formatBalancePointResponse(result, userSettings);
      } catch (err) {
        console.error("Balance point calculation failed:", err);
        return "I encountered an error calculating your balance point. Please check your system settings and try again.";
      }
    }

    // A/C Charging Calculator
    if (action === "calculateCharging") {
      try {
        const params = {
          refrigerant: command.refrigerant || "R-410A",
          outdoorTemp: command.outdoorTemp || 85,
        };
        const result = calculateCharging(params);
        return formatChargingResponse(result);
      } catch (err) {
        console.error("Charging calculation failed:", err);
        return "I encountered an error with the charging calculator. Please specify refrigerant type and outdoor temperature.";
      }
    }

    // Performance Analyzer
    if (action === "calculatePerformance") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const result = calculatePerformanceMetrics(userSettings);
        return formatPerformanceResponse(result, userSettings);
      } catch (err) {
        console.error("Performance calculation failed:", err);
        return "I encountered an error calculating system performance. Please check your settings.";
      }
    }

    // Setback Savings Calculator
    if (action === "calculateSetback") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const params = {
          winterTemp: userSettings.winterThermostat || 68,
          summerTemp: userSettings.summerThermostat || 75,
          utilityCost: userSettings.utilityCost || 0.12,
          hspf2: userSettings.hspf2 || 9,
          seer: userSettings.efficiency || 16,
        };
        const result = calculateSetbackSavings(params);
        return formatSetbackResponse(result);
      } catch (err) {
        console.error("Setback calculation failed:", err);
        return "I encountered an error calculating setback savings. Please check your settings.";
      }
    }

    // System Comparison
    if (action === "compareSystem") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const balancePointResult = calculateBalancePoint(userSettings);
        const params = {
          squareFeet: userSettings.squareFeet || 2000,
          winterTemp: userSettings.winterThermostat || 68,
          electricRate: userSettings.utilityCost || 0.12,
          gasRate: userSettings.gasCost || 1.2,
          hspfHP: userSettings.hspf2 || 9,
          afueGas: 95,
          balancePoint: balancePointResult.balancePoint || 32,
        };
        const result = compareHeatingSystems(params);
        return formatComparisonResponse(result);
      } catch (err) {
        console.error("Comparison calculation failed:", err);
        return "I encountered an error comparing systems. Please check your settings.";
      }
    }

    // Direct thermostat CSV summary (avoid Groq round-trip if we have stored summary)
    if (action === "showCsvInfo") {
      try {
        const raw = localStorage.getItem("thermostatCSVData");
        if (raw) {
          const obj = JSON.parse(raw);
          const msg = `Thermostat CSV summary: ${obj.rowCount || "N/A"} rows, ${obj.dateRange || "unknown"
            }; avg indoor ${obj.avgIndoor || "N/A"}°F, avg outdoor ${obj.avgOutdoor || "N/A"
            }°F, total runtime ${obj.totalRuntime || "N/A"} hrs.`;
          return msg;
        }
        return "No thermostat CSV summary found. Upload a file on the Performance Analyzer page first.";
      } catch {
        return "Failed to read stored thermostat CSV summary.";
      }
    }

    // Energy usage queries
    if (action === "energyUsage") {
      try {
        const energyHistory = JSON.parse(
          localStorage.getItem("energyHistory") || "[]"
        );
        const days = command.days || 10;
        const now = Date.now();
        const cutoff = now - days * 24 * 60 * 60 * 1000;

        const recent = energyHistory.filter((entry) => {
          const entryTime = new Date(entry.date).getTime();
          return entryTime >= cutoff;
        });

        if (recent.length === 0) {
          return `No energy data found for the last ${days} days. Energy tracking starts when you use the forecast or budget tools.`;
        }

        const totalKwh = recent.reduce(
          (sum, entry) => sum + (entry.kwh || 0),
          0
        );
        const avgPerDay = totalKwh / days;
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const rate = userSettings.utilityCost || 0.12;
        const totalCost = totalKwh * rate;

        return `In the last ${days} days, you used ${totalKwh.toFixed(
          1
        )} kWh (avg ${avgPerDay.toFixed(
          1
        )} kWh/day), costing approximately $${totalCost.toFixed(2)}.`;
      } catch {
        return "Sorry, I couldn't retrieve your energy usage data.";
      }
    }

    if (action === "averageDaily") {
      try {
        const energyHistory = JSON.parse(
          localStorage.getItem("energyHistory") || "[]"
        );
        if (energyHistory.length === 0) {
          return "No energy data available yet. Use the forecast or budget tools to start tracking.";
        }

        const totalKwh = energyHistory.reduce(
          (sum, entry) => sum + (entry.kwh || 0),
          0
        );
        const avgPerDay = totalKwh / energyHistory.length;

        return `Your average daily energy use is ${avgPerDay.toFixed(
          1
        )} kWh based on ${energyHistory.length} days of data.`;
      } catch {
        return "Sorry, I couldn't calculate your average daily usage.";
      }
    }

    if (action === "monthlySpend") {
      try {
        const energyHistory = JSON.parse(
          localStorage.getItem("energyHistory") || "[]"
        );
        if (energyHistory.length === 0) {
          return "No energy data available yet. Use the budget tool to start tracking monthly costs.";
        }

        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        const rate = userSettings.utilityCost || 0.12;

        // Get last 30 days
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const recent = energyHistory.filter((entry) => {
          const entryTime = new Date(entry.date).getTime();
          return entryTime >= thirtyDaysAgo;
        });

        const totalKwh = recent.reduce(
          (sum, entry) => sum + (entry.kwh || 0),
          0
        );
        const monthlyCost = totalKwh * rate;

        return `Based on the last 30 days, your monthly electricity cost is approximately $${monthlyCost.toFixed(
          2
        )} (${totalKwh.toFixed(0)} kWh at $${rate.toFixed(3)}/kWh).`;
      } catch {
        return "Sorry, I couldn't calculate your monthly spending.";
      }
    }

    if (action === "calculateBalancePoint") {
      try {
        const userSettings = JSON.parse(
          localStorage.getItem("userSettings") || "{}"
        );
        // Simple balance point estimate based on indoor setpoint and insulation
        const winterTemp = userSettings.winterThermostat || 68;
        const insul = userSettings.insulationLevel || 1.0;
        // Better insulation = lower balance point
        const balancePoint = Math.round(winterTemp + 10 / insul);

        return `Your estimated balance point is around ${balancePoint}°F. Below this outdoor temperature, your heat pump needs to run to maintain ${winterTemp}°F indoors. Visit the energy flow page for visualization.`;
      } catch {
        return "Visit the energy flow page to see your balance point visualization.";
      }
    }

    if (action === "compareSystem") {
      return "Visit the system comparison page to compare heat pump vs gas furnace costs for your home.";
    }

    // Navigation commands - execute immediately and return
    if (action === "navigate") {
      const routes = {
        home: "/",
        forecast: "/cost-forecaster",
        comparison: "/cost-comparison",
        balance: "/energy-flow",
        charging: "/charging-calculator",
        analyzer: "/performance-analyzer",
        methodology: "/methodology",
        settings: "/settings",
        thermostat: "/thermostat-analyzer",
        budget: "/monthly-budget",
        roi: "/cost-comparison",
        contactors: "/contactor-demo",
      };

      if (routes[target]) {
        navigate(routes[target]);
        return `Opening ${target} page...`;
      }
      return `I don't know how to navigate to ${target}.`;
    }

    // Settings modification commands - update localStorage only, no reload
    try {
      const userSettings = JSON.parse(
        localStorage.getItem("userSettings") || "{}"
      );
      let updated = false;
      let message = "";

      if (action === "setWinterTemp") {
        userSettings.winterThermostat = value;
        message = `Winter thermostat set to ${value}°F`;
        updated = true;
      } else if (action === "setSummerTemp") {
        userSettings.summerThermostat = value;
        message = `Summer thermostat set to ${value}°F`;
        updated = true;
      } else if (action === "setThermostat") {
        userSettings.winterThermostat = value;
        message = `Temperature set to ${value}°F.`;
        updated = true;
      } else if (action === "setSEER") {
        userSettings.seer2 = value;
        message = `SEER set to ${value}`;
        updated = true;
      } else if (action === "setHSPF") {
        userSettings.hspf2 = value;
        message = `HSPF set to ${value}`;
        updated = true;
      } else if (action === "setRates") {
        const el = Number(command.electricRate);
        const gl = Number(command.gasRate);
        if (!isNaN(el)) userSettings.utilityCost = el;
        if (!isNaN(gl)) userSettings.gasCost = gl;
        message = `Rates updated: electricity $${(
          userSettings.utilityCost ?? el
        ).toFixed(3)}/kWh, gas $${(userSettings.gasCost ?? gl).toFixed(
          2
        )}/therm`;
        updated = true;
      } else if (action === "setUtilityCost") {
        // Value from parser is already converted (cents to dollars if needed)
        userSettings.utilityCost = value;
        message = `Electricity rate set to $${value.toFixed(3)}/kWh`;
        updated = true;
      } else if (action === "setGasCost") {
        userSettings.gasCost = value;
        message = `Gas cost set to $${value}/therm`;
        updated = true;
      } else if (action === "setHeatingTemp") {
        userSettings.winterThermostat = value;
        message = `Heating setpoint set to ${value}°F`;
        updated = true;
      } else if (action === "setCoolingTemp") {
        userSettings.summerThermostat = value;
        message = `Cooling setpoint set to ${value}°F`;
        updated = true;
      } else if (action === "setSquareFeet") {
        userSettings.squareFeet = value;
        message = `Square footage set to ${value.toLocaleString()} sq ft`;
        updated = true;
      } else if (action === "setInsulationLevel") {
        userSettings.insulationLevel = value;
        message = `Insulation set to ${command.raw}`;
        updated = true;
      } else if (action === "setCeilingHeight") {
        userSettings.ceilingHeight = value;
        message = `Ceiling height set to ${value} feet`;
        updated = true;
      } else if (action === "setAuxHeat") {
        userSettings.useElectricAuxHeat = value;
        message = `Auxiliary heat ${value ? "enabled" : "disabled"}`;
        updated = true;
      } else if (action === "setLocation") {
        // Geocode the provided city name and persist as userLocation
        const cityQuery = (command.cityName || "").trim();
        if (!cityQuery) {
          return 'Please provide a city, e.g., "Denver" or "Denver, CO".';
        }
        try {
          const candidates = await fetchGeocodeCandidates(cityQuery);
          const best = chooseBestCandidate(candidates);
          if (!best) {
            return `I couldn't find "${cityQuery}". Try including the state, e.g., "Denver, CO".`;
          }

          const city = best.name;
          const state = best.admin1 || "";
          const latitude = best.latitude;
          const longitude = best.longitude;
          const elevationInFeet = best.elevation
            ? Math.round(best.elevation * 3.28084)
            : 0;

          // Save canonical location for the whole app
          const locationObj = {
            city,
            state,
            latitude,
            longitude,
            elevation: elevationInFeet,
          };
          localStorage.setItem("userLocation", JSON.stringify(locationObj));

          // Also reflect in userSettings for AI and other tools
          userSettings.city = `${city}${state ? ", " + state : ""}`;
          userSettings.latitude = latitude;
          userSettings.longitude = longitude;
          userSettings.homeElevation = elevationInFeet;

          // Mark onboarding as completed so manual mode won't bounce to onboarding again
          try {
            localStorage.setItem("hasCompletedOnboarding", "true");
          } catch {
            // Ignore localStorage errors
          }

          message = `Location set to ${city}${state ? ", " + state : ""
            } (${elevationInFeet} ft).`;
          updated = true;
        } catch (geoErr) {
          console.error("Geocoding failed:", geoErr);
          return "Sorry, I could not look up that location.";
        }
      }

      if (updated) {
        localStorage.setItem("userSettings", JSON.stringify(userSettings));
        // Settings will be picked up by components on next render - no reload needed
        return message;
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
      return "Sorry, I couldn't update that setting.";
    }

    return null;
  };

  // Handle queries using the unified agent system
  const handleAgenticQuery = async (query) => {
    setIsLoadingGroq(true);
    setIsAgenticProcessing(true);
    setExecutionProgress([]);
    setLoadingMessage("🤖 Planning agent execution...");
    try {
      const result = await answerWithAgent(
        query,
        groqApiKey,
        thermostatData,
        _effectiveUserSettings,
        _effectiveUserLocation,
        history,
        {
          mode: 'advanced',
          enableProactive: true,
          maxRetries: 2,
          onProgress: (step) => {
            setExecutionProgress(prev => [...prev, step]);
            setLoadingMessage(`⚙️ Executing: ${step.name || step.tool}...`);
          },
        }
      );

      setIsAgenticProcessing(false);
      
      // Format result for display
      if (result.error) {
        setError(result.message);
        setAgenticResponse(null);
      } else {
        // Set agentic response for advanced mode display
        setAgenticResponse({
          success: true,
          message: result.message,
          response: result.message,
          reasoning: result.reasoning,
          executedTools: result.executedTools,
          confidence: result.confidence,
          metadata: result.metadata,
        });
        // Also set answer for standard display
        setAnswer(result.message);
      }

      // Speak the response if TTS is enabled
      if (ttsOn) {
        // Extract text properly - handle all response formats
        let textToSpeak = "";

        if (result.error && result.message) {
          // Error case
          textToSpeak = result.message;
        } else if (result.success && result.message) {
          // Success with message format (from LLM)
          textToSpeak = result.message;
        } else if (typeof result.response === "string") {
          // Direct string response
          textToSpeak = result.response;
        } else if (result.response?.success && result.response?.message) {
          // Nested success/message object
          textToSpeak = result.response.message;
        } else if (result.response?.response) {
          // Nested response object
          textToSpeak = result.response.response;
        }

        if (textToSpeak) {
          speak(sanitizeAnswer(textToSpeak));
        }
      }

      // Add to conversation history
      addInteraction({
        intent: result.reasoning?.intent || "agentic_query",
        raw: query,
        response: result,
        metadata: {
          confidence: result.confidence,
          toolsUsed: result.executedTools,
        },
      });

      setValue("");
      setLoadingMessage("");
    } catch (error) {
      console.error("Agentic query failed:", error);
      setIsAgenticProcessing(false);
      setError(
        "Failed to process your query with the agentic AI. " + error.message
      );
      setLoadingMessage("");
    } finally {
      setIsLoadingGroq(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setAnswer("");
    setAgenticResponse(null);
    setLoadingMessage("");
    setHistoryIndex(-1);

    const resolvedInput = resolvePronouns(value, history);

    // Save to history
    if (resolvedInput.trim()) {
      saveToHistory(resolvedInput.trim());
    }

    // 1) Always try explicit commands first (works regardless of AI mode)
    const commandParsed = parseAskJoule(resolvedInput, { lastQuery: value, userSettings, userLocation, annualEstimate });
    if (process.env.NODE_ENV === 'test' && commandParsed) {
       
      console.log('AskJoule.handleSubmit parsed command:', commandParsed);
    }
    if (commandParsed.isCommand) {
      // Always notify parent via onParsed callback for commands
      onParsed?.({ isCommand: true, ...commandParsed });

      // Set loading message based on command type
      const loadingMessages = {
        calculateBalancePoint: "📊 Calculating balance point...",
        calculateCharging: "🔧 Calculating A/C charging...",
        calculatePerformance: "⚡ Analyzing system performance...",
        calculateSetback: "💰 Calculating setback savings...",
        compareSystem: "📈 Comparing systems...",
        fullAnalysis: "🔍 Running comprehensive analysis...",
        systemAnalysis: "🔍 Analyzing system...",
        costForecast: "📅 Forecasting costs...",
        savingsAnalysis: "💵 Analyzing savings...",
      };
      setLoadingMessage(
        loadingMessages[commandParsed.action] || "⚙️ Processing command..."
      );

      // Try to execute the command internally
      const executed = await executeAskJouleCommand(commandParsed);
      if (executed) {
        setAnswer(executed);
        speak(executed);
        addInteraction({
          intent: commandParsed.action,
          raw: value,
          response: executed,
        });
        setValue("");
        setLoadingMessage("");
        return;
      }

      setLoadingMessage("");

      // Command not handled internally - check if we should route to Groq instead
      const spoken = (() => {
        if (commandParsed.action === "increaseTemp")
          return `Raising temperature by ${commandParsed.value} degrees.`;
        if (commandParsed.action === "decreaseTemp")
          return `Lowering temperature by ${commandParsed.value} degrees.`;
        if (commandParsed.action === "setTemp")
          return `Setting temperature to ${commandParsed.value} degrees.`;
        if (commandParsed.action === "openForecast") return "Opening forecast tool.";
        if (commandParsed.action === "checkShortCycling")
          return "Checking for short cycling diagnostics.";
        if (commandParsed.action === "presetSleep") return "Switching to sleep mode.";
        if (commandParsed.action === "presetHome") return "Switching to home mode.";
        if (commandParsed.action === "presetAway") return "Switching to away mode.";
        if (commandParsed.action === "navigate") {
          const pageNames = {
            home: "home dashboard",
            forecast: "cost forecaster",
            comparison: "system comparison",
            balance: "energy flow",
            charging: "charging calculator",
            analyzer: "performance analyzer",
            methodology: "methodology",
            settings: "settings",
            thermostat: "thermostat analyzer",
            budget: "monthly budget",
            roi: "upgrade analysis",
          };
          return `Opening ${pageNames[commandParsed.target] || commandParsed.target}.`;
        }
        // For unhandled commands, route to Groq if available
        if (groqApiKey && (aiMode || agenticMode)) {
          return null; // Signal to route to Groq
        }
        return "Command received.";
      })();

      // If spoken is null, route to Groq instead
      if (spoken === null) {
        fetchGroqLLM(value);
        return;
      }

      setAnswer(spoken);
      speak(spoken);
      addInteraction({ intent: commandParsed.action, raw: value, response: spoken });
      setValue("");
      setLoadingMessage("");
      return;
    }

    // 2) New thermostat NLP parsing
    const thermo = parseThermostatCommand(resolvedInput);
    if (thermo.intent !== "unknown") {
      setLoadingMessage("🎛️ Processing thermostat command...");
      onParsed?.({ isCommand: true, action: thermo.intent, ...thermo });
      const execRes = executeCommand(thermo);
      const spoken = execRes.message;
      setAnswer(spoken);
      speak(spoken);
      addInteraction({ intent: thermo.intent, raw: value, response: spoken });
      setLoadingMessage("");
      return;
    }

    // 3) If Agentic Mode is enabled, use advanced planning mode
    if (agenticMode) {
      handleAgenticQuery(resolvedInput);
      return;
    }

    // Otherwise fall back to structured parameter parsing
    setLoadingMessage("🔍 Parsing query...");
    setError('');
    setOutputStatus('');
    setShowSuggestions(false);
    stop(); // Stop any ongoing speech
    const parsed = parseAskJoule(value, { lastQuery, userSettings, userLocation, annualEstimate });
    setLastQuery(parsed);

    // Handle commands first
    if (handleCommand(parsed)) {
      setValue(''); // Clear input after command
      return;
    }

    const hasAny = parsed.cityName || parsed.squareFeet || parsed.indoorTemp || parsed.insulationLevel || parsed.primarySystem || parsed.energyMode;
    if (!hasAny) {
      // If Groq API key is present, prompt user for LLM fallback
      if (groqApiKey) {
        setShowGroqPrompt(true);
        return;
      }
      setError('Sorry, I could not understand. Try: "What can I save?" or "My score" or "2,000 sq ft in Atlanta at 70"');
      setOutputStatus('error');
      return;
    }
    if (!parsed.cityName && !hasLocation) {
      const msg = 'Add a city (e.g., "Denver, CO") or set your location first.';
      setError(msg);
      if (ttsOn) speak(msg);
      addInteraction({
        intent: "missingLocation",
        raw: value,
        response: "Add location",
      });
      return;
    }
    onParsed?.(parsed);
    addInteraction({
      intent: "structuredQuery",
      raw: value,
      response: "parsed",
    });
  };

  // Keep latest handleSubmit in ref for SpeechRecognition trigger
  submitRef.current = handleSubmit;

  // Enhanced Groq LLM with context
  async function fetchGroqLLM(query) {
    setIsLoadingGroq(true);
    setError("");
    setAnswer("");
    setLoadingMessage("🧠 Generating AI response...");

    // Get thermostat data from localStorage if available
    let thermostatData = null;
    try {
      const stored = localStorage.getItem("thermostatCSVData");
      if (stored) {
        thermostatData = JSON.parse(stored);
      }
    } catch {
      /* ignore */
    }

    try {
      // Use unified agent (simple mode by default)
      const result = await answerWithAgent(
        query,
        groqApiKey,
        thermostatData,
        _effectiveUserSettings,
        _effectiveUserLocation,
        history, // Pass conversation history
        { mode: 'simple' } // Use simple mode for non-agentic queries
      );

      if (result?.error) {
        const errorMsg =
          result.message || "An error occurred with the AI response.";
        if (result.needsSetup) {
          setError(
            <div>
              <strong>{errorMsg}</strong>
              <p className="mt-2 text-sm">To use AI-powered responses:</p>
              <ol className="list-decimal list-inside text-sm mt-1 space-y-1">
                <li>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    Get a free API key from Groq
                  </a>
                </li>
                <li>
                  Go to{" "}
                  <a
                    href="/settings"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    Settings
                  </a>{" "}
                  and paste your key
                </li>
              </ol>
            </div>
          );
          speak(errorMsg + " Please check settings to add your Groq API key.");
        } else if (result.needsModelUpdate) {
          setError(
            <div>
              <strong>{errorMsg}</strong>
              <p className="mt-2 text-sm">
                Go to{" "}
                <a
                  href="/settings"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Settings
                </a>{" "}
                to select a different model.
              </p>
            </div>
          );
          speak(
            errorMsg + " Please check settings to select a different model."
          );
        } else {
          setError(errorMsg);
          speak(errorMsg);
        }
        return;
      }

      if (!result?.message) throw new Error("Empty response from Groq");
      const sanitized = sanitizeAnswer(result.message);
      setAnswer(sanitized);
      speak(sanitized);
      setLoadingMessage("");
    } catch (err) {
      const msg = (err?.message || "Unknown error").toString();
      const fullMsg = "Unexpected error: " + msg;
      setError(fullMsg);
      speak(fullMsg);
      setLoadingMessage("");
    } finally {
      setIsLoadingGroq(false);
      setShowGroqPrompt(false);
    }
  }
  // Remove verbose disclaimers / duplicate sentences and strip Markdown for nicer TTS/UI
  function sanitizeAnswer(raw) {
    if (!raw) return raw;
    let text = String(raw);

    // Strip common AI disclaimers
    text = text
      .replace(/^(?:I'm|I am)\s+(?:an?|the)\s+[^.]+?assistant[,\s]+/i, "")
      .replace(/^(?:I'm|I am)\s+designed[^.]+\./i, "")
      .replace(/As an AI[^.]+\./gi, "")
      .replace(/I (?:cannot|can't) (?:hear|receive)[^.]+\./gi, "")
      .trim();

    // Basic Markdown cleanup (bold/italics, headings, bullets, links, code)
    text = text
      // Headings
      .replace(/^#{1,6}\s*/gm, "")
      // Links [label](url) -> label
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // Bold/italics
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Inline/fenced code
      .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      // Bullets/numbered lists
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "");

    // Collapse whitespace
    text = text.replace(/\s+/g, " ");

    // Remove exact duplicate sentences only (preserve varied sentences)
    const sentences = text.split(/(?<=[.!?])\s+/);
    const seen = new Set();
    const filtered = [];
    for (const s of sentences) {
      const key = s.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        filtered.push(s);
      }
    }
    text = filtered.join(" ");

    // Length cap only if excessively long
    if (text.length > 800)
      text = text.slice(0, 780).replace(/[^\w.!?]+$/, "") + "…";
    return text;
  }
  // Removed centralized one-time speak effect; speaking now occurs immediately on setting answer.

  return (
    <div
      className={`border-2 border-blue-300 dark:border-blue-600 rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm ${isModal ? "max-h-[80vh] overflow-y-auto" : ""
        }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-800 flex items-center justify-center">
          <Zap className="text-blue-600 dark:text-blue-300" size={24} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Ask Joule
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Natural language commands, what-if scenarios, and insights
          </p>
        </div>
        {isModal && (
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="space-y-6">
        {/* Input / description panel */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3">
            <strong>Ask Joule</strong> is your home energy assistant — ask
            natural language questions, run what-if scenarios (HSPF, SEER,
            thermostat changes), request estimates, or navigate to calculators
            and analysis tools. If Ask Joule can’t parse your question, you can
            use your Groq LLM key (Settings) to get richer answers.
          </p>
          {/* Consolidated main form (moved/kept lower form) - earlier duplicate removed */}
        </div>

        {/* Output panel */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 min-h-[170px] flex flex-col justify-between">
          <div className="flex-1 mb-3 text-sm sm:text-base text-gray-800 dark:text-gray-100 whitespace-pre-line">
            {/* Agentic AI Response */}
            {agenticResponse && (
              <AgenticResponse
                result={agenticResponse}
                isProcessing={isAgenticProcessing}
                executionProgress={executionProgress}
              />
            )}

            {/* Standard Answer */}
            {answer && !error && !agenticResponse && (
              <>
                <div data-testid="askjoule-answer">{answer}</div>
                <ActionButtons responseText={answer} navigate={navigate} />
              </>
            )}
            {error && (
              <div
                className="text-red-600 dark:text-red-400 text-sm"
                data-testid="askjoule-error"
              >
                {error}
              </div>
            )}
            {loadingMessage && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent"></div>
                <span>{loadingMessage}</span>
              </div>
            )}
            {/* Proactive Alerts */}
            {hasAlerts && proactiveAlerts.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                      Proactive Alert
                    </div>
                    {proactiveAlerts.map((alert, idx) => (
                      <div key={idx} className="text-sm text-amber-700 dark:text-amber-300">
                        {alert.message}
                      </div>
                    ))}
                    <button
                      onClick={checkAlerts}
                      className="mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Briefing (show in morning) */}
            {briefing && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 text-lg">📊</span>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                      Daily Briefing
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-line">
                      {briefing.summary && (
                        <>
                          <div>Energy: {briefing.summary.energyUsage?.totalKwh || 'N/A'} kWh (${briefing.summary.energyUsage?.cost || 'N/A'})</div>
                          <div>System: {briefing.summary.systemHealth?.status || 'normal'}</div>
                          {briefing.summary.recommendations?.length > 0 && (
                            <div className="mt-2">
                              <strong>Recommendations:</strong>
                              {briefing.summary.recommendations.map((rec, idx) => (
                                <div key={idx}>• {rec.message}</div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setBriefing(null)}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!answer && !error && !loadingMessage && !hasAlerts && !briefing && (
              <div className="text-gray-600 dark:text-gray-300">
                {userLocation ? (
                  <>
                    For {userLocation.city ?? ""}
                    {userLocation.state ? `, ${userLocation.state}` : ""}:
                    typical HSPF 9-10, SEER 15-16.
                    <br />
                    Check Cost Forecaster for detailed analysis.
                  </>
                ) : (
                  "Enter a question to get started."
                )}
                <RandomTip />
              </div>
            )}
            {isListening && transcript && (
              <div
                className="mt-2 text-xs text-blue-600 dark:text-blue-300"
                data-testid="askjoule-live-transcript"
              >
                {transcript}
              </div>
            )}
            {/* Speech diagnostics */}
            {speechSupported ? (
              <div
                className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-1"
                data-testid="askjoule-speech-status"
              >
                <div>
                  Mic: {isListening ? "listening" : "idle"}
                  {restartCount > 0 ? ` · restarts: ${restartCount}` : ""}
                </div>
                {speechError && (
                  <div className="text-red-600 dark:text-red-400">
                    Speech error: {speechError}
                  </div>
                )}
                {restartCount >= 8 && !speechError && (
                  <div className="text-amber-600 dark:text-amber-400">
                    Multiple restarts – check mic permission or input device.
                  </div>
                )}
              </div>
            ) : (
              <div
                className="mt-3 text-[11px] text-gray-500 dark:text-gray-400"
                data-testid="askjoule-speech-unsupported"
              >
                Browser speech recognition unsupported – try Chrome desktop for
                voice.
              </div>
            )}
            {showGroqPrompt && (
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700 rounded">
                <p className="text-sm mb-2">
                  Your question could not be understood. Send to Groq for a
                  better answer?
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn btn-primary px-3 py-1"
                    disabled={isLoadingGroq}
                    onClick={() => fetchGroqLLM(value)}
                  >
                    {isLoadingGroq ? "Sending..." : "Send to Groq"}
                  </button>
                  <button
                    className="btn btn-outline px-3 py-1"
                    disabled={isLoadingGroq}
                    onClick={() => setShowGroqPrompt(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
            Try: "What can I save?" • "My score" • "Set winter to 68" • "Show me
            Denver"
          </div>
        </div>
      </div>
      {/* Personalization panel injected below Ask Joule interface */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PreferencePanel />
        <LocationSettings />
      </div>
      <form onSubmit={handleSubmit} className="w-full flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 relative w-full">
          {/* Description: brief overview of capability - shown inside the component so every instance has it */}
          <div data-testid="ask-joule-description" className="mb-2 text-[13px] sm:text-sm text-gray-700 dark:text-gray-300">
            <strong className="font-semibold">Ask Joule</strong> is your home energy assistant — ask natural language questions, run what-if scenarios (HSPF, SEER, thermostat changes), request estimates, or navigate to calculators and analysis tools. If Ask Joule can’t parse your question, you can use your Groq LLM key (Settings) to get richer answers.
          </div>
          {groqApiKey && groqModel && (
            <div className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                Using model: <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded font-mono text-[10px]">{groqModel}</code>
                <span className="text-gray-400 dark:text-gray-500">�</span>
                <button
                  type="button"
                  onClick={() => onNavigate ? onNavigate('/settings') : navigate('/settings')}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Change model
                </button>
              </span>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (outputStatus) setOutputStatus(''); }}
            onFocus={() => value.length > 2 && setSuggestions(suggestions)}
            placeholder={placeholder}
            className="w-full p-4 rounded-xl border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-lg sm:text-xl text-gray-900 dark:text-gray-100 shadow-md focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none"
            aria-label="Ask Joule"
            aria-describedby="ask-joule-hint"
            disabled={disabled}
          />
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setValue(suggestion);
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900 text-sm sm:text-base text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary px-8 py-4 text-lg sm:text-xl font-semibold min-w-[120px]" disabled={disabled}>
          Ask
        </button>

        {/* Command help & audit toggles */}
        <div className="ml-2 flex flex-wrap items-center gap-2">
          <button data-testid="ask-joule-command-help-button" type="button" className="btn btn-outline px-4 py-2.5 text-sm font-medium" onClick={() => setShowCommandHelp(s => !s)}>
            Commands
          </button>
          <button data-testid="ask-joule-audit-button" type="button" className="btn btn-outline px-4 py-2.5 text-sm font-medium" onClick={() => setShowAudit(s => !s)}>
            History {auditLog && auditLog.length > 0 ? `(${auditLog.length})` : ''}
          </button>
          {/* Microphone button for speech-to-text */}
          {recognitionSupported && (
            <button
              data-testid="ask-joule-mic-toggle"
              type="button"
              className={`btn px-4 py-2.5 text-sm flex items-center gap-2 ${isListening ? 'btn-primary listening-pulse' : 'btn-outline'}`}
              onClick={toggleListening}
              title={isListening ? 'Listening... Click to stop' : 'Click to speak'}
            >
              {isListening ? (
                <>
                  <Mic size={18} className="text-white" />
                  <span className="speaking-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </>
              ) : (
                <MicOff size={18} />
              )}
            </button>
          )}
          {/* Speech toggle button */}
          {speechSupported && (
            <button
              data-testid="ask-joule-speech-toggle"
              type="button"
              className={`btn px-4 py-2.5 text-sm flex items-center gap-2 ${speechEnabled ? 'btn-primary' : 'btn-outline'}`}
              onClick={toggleSpeech}
              title={speechEnabled ? 'Voice enabled - Click to disable' : 'Voice disabled - Click to enable'}
            >
              {speechEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              {isSpeaking && (
                <span className="speaking-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Quick suggestion chips (below input/prompt) */}
      {!value && !error && contextualSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {contextualSuggestions.slice(0, 4).map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setValue(suggestion)}
              className="text-sm sm:text-sm px-4 py-2 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors shadow-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Bottom: Output area */}
      <div className="mt-4 w-full bg-white/70 dark:bg-gray-900/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-inner">
        <div data-testid="ask-joule-output-area" className="min-h-[6rem] sm:min-h-[8rem] text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-100">
          {error ? (
            <p data-testid="ask-joule-output" role="status" aria-live="polite" className={`flex items-center gap-2 ${outputStatus === 'success' ? 'text-green-600 dark:text-green-400' : (outputStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')}`}>
              <span data-testid="ask-joule-output-icon" className="flex items-center">
                {outputStatus === 'success' ? (
                  <CheckCircle2 size={18} title="Success" className="text-green-600 dark:text-green-400" />
                ) : outputStatus === 'error' ? (
                  <XCircle size={18} title="Error" className="text-red-600 dark:text-red-400" />
                ) : (
                  <Info size={18} title="Info" className="text-blue-600 dark:text-blue-400" />
                )}
              </span>
              <span>{error}</span>
            </p>
          ) : (
            <p className="text-gray-700 dark:text-gray-300 opacity-90">{''}</p>
          )}
          {/* Human-friendly status helper */}
          {outputStatus === 'success' && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400">Command accepted — changes applied.</div>
          )}
          {outputStatus === 'error' && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">Command not accepted — no changes applied.</div>
          )}
          {outputStatus === 'info' && (
            <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">Information: suggestions or analysis only.</div>
          )}
        </div>
        {showGroqPrompt && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded">
            <p className="text-sm text-gray-800 dark:text-gray-100 mb-2">Send to Groq's LLM for a better answer? (Uses your API key.)</p>
            <div className="flex gap-2 mt-2">
              <button
                className="btn btn-primary px-3 py-1"
                disabled={isLoadingGroq}
                onClick={() => fetchGroqLLM(value)}
              >{isLoadingGroq ? 'Sending...' : 'Send to Groq'}</button>
              <button
                className="btn btn-outline px-3 py-1"
                disabled={isLoadingGroq}
                onClick={() => setShowGroqPrompt(false)}
              >Cancel</button>
            </div>
          </div>
        )}
        <p id="ask-joule-hint" className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
          Try: "What can I save?" • "My score" • "Set winter to 68" • "Show me Denver"
        </p>
      </div>
      {/* Command help list */}
      {showCommandHelp && (
        <div data-testid="ask-joule-commands" className="mt-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="mb-2 font-semibold">Ask Joule — supported commands</div>
          <ul className="list-disc ml-5">
            <li>Set thermostat: "Set winter to 68" / "Set summer to 74"</li>
            <li>Set efficiency: "Set HSPF to 10" / "Set SEER to 18"</li>
            <li>Set utility: "Set utility cost to $0.12"</li>
            <li>Change house details: "Set square feet to 2000" / "Set insulation to good"</li>
            <li>System: "Set capacity to 36" / "Set AFUE to 0.95"</li>
            <li>Aux heat: "Turn off aux heat" / "Use electric aux heat on/off"</li>
            <li>Location: "Set location to Denver, CO"</li>
            <li>Undo: "Undo" or "Undo last change"</li>
          </ul>
        </div>
      )}

      {/* Audit history */}
      {showAudit && (
        <div data-testid="ask-joule-audit-log" className="mt-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Ask Joule: Command history</div>
            <div className="text-xs text-gray-500">Showing last {Math.min((auditLog && auditLog.length) || 0, 10)} changes</div>
          </div>
          {!auditLog || auditLog.length === 0 ? (
            <div className="text-xs text-gray-600">No recent Ask Joule changes.</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {auditLog.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 text-xs text-gray-700 dark:text-gray-200">
                    <strong>{new Date(entry.timestamp).toLocaleString()}</strong>: {entry.key} {typeof entry.newValue !== 'undefined' ? `→ ${JSON.stringify(entry.newValue)}` : ''}
                    <div className="text-xs text-gray-500">{entry.source || 'ui'} {entry.comment ? `• ${entry.comment}` : ''}</div>
                  </div>
                  <div className="flex gap-1">
                    <button data-testid={`ask-joule-undo-${entry.id}`} type="button" className="btn btn-outline btn-sm px-2 py-1 text-xs" onClick={() => { if (onUndo) { onUndo(entry.id); setError('✓ Undo requested'); } }}>
                      Undo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AskJoule;

// Export internal parser for unit tests (non-breaking)


