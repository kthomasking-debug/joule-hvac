import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Settings,
  ChevronRight,
  Home,
  ThermometerSun,
  Flame,
  Mic,
  Snowflake,
  HelpCircle,
  Shield,
  FileText,
  Crown,
  Lock,
  CheckCircle2,
  Trash2,
  RotateCcw,
  XCircle,
  Server,
  Circle,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchGroqModels,
  suggestModel,
  formatModelLabel,
  getModelDescription,
} from "../lib/groqModels";
import { fullInputClasses } from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import { Toast } from "../components/Toast";
import { useOutletContext } from "react-router-dom";
import { resizeToCover } from "../lib/imageProcessing";
import {
  saveCustomHeroBlob,
  getCustomHeroUrl,
  deleteCustomHero,
} from "../lib/userImages";
import ThermostatSettingsPanel from "../components/ThermostatSettingsPanel";
import EcobeeSettings from "../components/EcobeeSettings";
import ProstatBridgeSettings from "../components/ProstatBridgeSettings";
import { setProCode, clearProCode, hasProAccess } from "../utils/demoMode";

const Section = ({ title, icon, children, ...props }) => (
  <div
    className="glass-card p-glass space-y-4 animate-fade-in-up"
    {...props}
  >
    <h2 className="heading-secondary flex items-center gap-3">
      <div className="icon-container">
        {icon}
      </div>
      {title}
    </h2>
    {children}
  </div>
);

const ProCodeInput = () => {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem('proCode') || '';
    } catch {
      return '';
    }
  });
  const [proAccess, setProAccess] = useState({ hasAccess: false, source: null });
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const access = await hasProAccess();
    setProAccess(access);
  };

  const handleSetCode = async () => {
    if (!code.trim()) {
      setMessage('Please enter a Pro code');
      return;
    }

    const success = setProCode(code.trim());
    if (success) {
      setMessage('Pro code saved! Checking access...');
      await checkAccess();
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Failed to save Pro code');
    }
  };

  const handleClearCode = () => {
    clearProCode();
    setCode('');
    setMessage('Pro code cleared');
    checkAccess();
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Enter your Pro code to unlock advanced features. Codes are provided when you purchase the Monitor tier ($20/year) or Bridge hardware ($129).
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Pro Code
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PRO-XXXX"
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono uppercase"
            aria-label="Pro Code"
          />
          <button
            type="button"
            onClick={handleSetCode}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-semibold"
          >
            Save
          </button>
          {code && (
            <button
              type="button"
              onClick={handleClearCode}
              className="px-3 py-2 rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`text-sm ${message.includes('saved') || message.includes('cleared') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </div>
      )}

      {proAccess.hasAccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="text-sm font-semibold text-green-900 dark:text-green-200">
                Pro Access Active
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">
                Unlocked via {proAccess.source === 'bridge' ? 'ProStat Bridge hardware' : 'Pro code'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VoicePicker = () => {
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try {
      return localStorage.getItem("askJouleVoice") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        // Filter to English voices and sort by preference (British first)
        const englishVoices = voices
          .filter((v) => v.lang.startsWith("en"))
          .sort((a, b) => {
            // Prioritize British English
            const aIsGB = a.lang === "en-GB" || a.name.toLowerCase().includes("uk") || a.name.toLowerCase().includes("british");
            const bIsGB = b.lang === "en-GB" || b.name.toLowerCase().includes("uk") || b.name.toLowerCase().includes("british");
            if (aIsGB && !bIsGB) return -1;
            if (!aIsGB && bIsGB) return 1;
            // Then prioritize male voices (deeper/more authoritative)
            const aIsMale = a.name.toLowerCase().includes("male");
            const bIsMale = b.name.toLowerCase().includes("male");
            if (aIsMale && !bIsMale) return -1;
            if (!aIsMale && bIsMale) return 1;
            return a.name.localeCompare(b.name);
          });
        setAvailableVoices(englishVoices);
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (e) => {
    const voiceName = e.target.value;
    setSelectedVoice(voiceName);
    try {
      if (voiceName) {
        localStorage.setItem("askJouleVoice", voiceName);
      } else {
        localStorage.removeItem("askJouleVoice");
      }
    } catch (err) {
      console.warn("Failed to save voice preference:", err);
    }
  };

  const getVoiceLabel = (voice) => {
    const lang = voice.lang === "en-GB" ? "🇬🇧 British" : voice.lang === "en-US" ? "🇺🇸 American" : "🇬🇧/🇺🇸";
    const gender = voice.name.toLowerCase().includes("male") ? "♂ Male" : voice.name.toLowerCase().includes("female") ? "♀ Female" : "";
    return `${lang} ${gender ? `- ${gender}` : ""} - ${voice.name}`;
  };

  if (availableVoices.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Loading voices...
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="voice-picker"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Voice Persona
      </label>
      <select
        id="voice-picker"
        value={selectedVoice}
        onChange={handleVoiceChange}
        className={fullInputClasses}
        aria-label="Voice persona selection"
      >
        <option value="">Default (Auto-select best voice)</option>
        {availableVoices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {getVoiceLabel(voice)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Choose a voice for Ask Joule. British English voices sound more formal and authoritative (JARVIS-like).
      </p>
    </div>
  );
};

const VoiceListenDurationInput = () => {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem("askJouleListenSeconds");
    if (raw === null || raw === undefined) return 5;
    const v = Number(raw);
    return Number.isNaN(v) ? 5 : v;
  });
  const handleChange = (e) => {
    const val = Math.max(2, Math.min(30, Number(e.target.value)));
    setValue(val);
    try {
      localStorage.setItem("askJouleListenSeconds", String(val));
    } catch {}
    window.dispatchEvent(new Event("askJouleListenSecondsChanged"));
  };
  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={2}
        max={30}
        step={1}
        value={value}
        onChange={handleChange}
        className="w-20 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center"
        aria-label="Voice listening duration"
      />
      <span className="text-sm text-gray-600 dark:text-gray-300">seconds</span>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        (How long voice input listens before auto-stopping)
      </p>
    </div>
  );
};

const ByzantineModeToggle = ({ setToast }) => {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("byzantineMode") === "true";
    } catch {
      return false;
    }
  });

  const handleToggle = (e) => {
    const newValue = e.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem("byzantineMode", newValue ? "true" : "false");
    } catch {}
    
    if (newValue) {
      setToast?.({
        message: "🕯️ Rejoice, Oh Coil Unfrosted! Byzantine Mode activated.",
        type: "success",
      });
    } else {
      setToast?.({
        message: "Byzantine Mode disabled. Joule returns to normal speech.",
        type: "info",
      });
    }
  };

  return (
    <div className="glass-card p-glass">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            🕯️ Byzantine Liturgical Mode
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Joule responds in the style of Orthodox liturgical chants
          </p>
          {enabled && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 italic">
              "Rejoice, Oh Coil Unfrosted! Glory to Thee, Oh Scroll Compressor!"
            </p>
          )}
        </div>
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={handleToggle}
          />
        </label>
      </div>
    </div>
  );
};

const LocalLLMSettings = () => {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("useLocalLLM") === "true";
    } catch {
      return false;
    }
  });
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      return localStorage.getItem("prostatBridgeUrl") || "http://localhost:8080";
    } catch {
      return "http://localhost:8080";
    }
  });
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem("localLLMModel") || "llama3.2:1b";
    } catch {
      return "llama3.2:1b";
    }
  });
  const [connectionStatus, setConnectionStatus] = useState("unknown"); // "unknown" | "connected" | "disconnected"
  const [testing, setTesting] = useState(false);

  const availableModels = [
    { id: "llama3.2:1b", label: "Llama 3.2 1B (Fast, 1GB RAM)", description: "Fastest option, good for simple queries" },
    { id: "llama3.2:3b", label: "Llama 3.2 3B (Better, 3GB RAM)", description: "Better quality, requires more RAM" },
    { id: "phi3:mini", label: "Phi-3 Mini (Balanced, 2GB RAM)", description: "Microsoft's efficient model" },
    { id: "tinyllama", label: "TinyLlama (Ultra-light, 500MB)", description: "Smallest model, basic functionality only" },
  ];

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("unknown");
    
    try {
      const response = await fetch(`${bridgeUrl}/api/llm/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test",
          model: model,
        }),
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      console.error("[Local LLM] Connection test failed:", error);
      setConnectionStatus("disconnected");
    } finally {
      setTesting(false);
    }
  };

  const handleEnabledChange = (e) => {
    const newValue = e.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem("useLocalLLM", newValue ? "true" : "false");
      if (newValue) {
        // Test connection when enabling
        testConnection();
      }
    } catch {}
  };

  const handleBridgeUrlChange = (e) => {
    const val = e.target.value.trim();
    setBridgeUrl(val);
    try {
      localStorage.setItem("prostatBridgeUrl", val);
    } catch {}
  };

  const handleModelChange = (e) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    try {
      localStorage.setItem("localLLMModel", selectedModel);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Use Local LLM (ProStat Bridge/Core)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Run LLM locally on your ProStat Bridge or Core instead of using Groq API. Requires Ollama installed.
          </p>
        </div>
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={handleEnabledChange}
          />
        </label>
      </div>

      {enabled && (
        <>
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              ProStat Bridge URL
            </label>
            <input
              type="text"
              value={bridgeUrl}
              onChange={handleBridgeUrlChange}
              placeholder="http://localhost:8080"
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="ProStat Bridge URL"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              URL of your ProStat Bridge or Core running the service
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Local LLM Model
            </label>
            <select
              value={model}
              onChange={handleModelChange}
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="Select Local LLM Model"
            >
              {availableModels.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {availableModels.find((m) => m.id === model)?.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 size={16} />
                <span>Connected to Bridge</span>
              </div>
            )}
            {connectionStatus === "disconnected" && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle size={16} />
                <span>Cannot reach Bridge</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
          ℹ️ Local LLM Benefits
        </p>
        <ul className="list-disc list-inside space-y-1 mb-2">
          <li>No API keys required</li>
          <li>Works offline (no internet needed)</li>
          <li>Unlimited queries (no rate limits)</li>
          <li>Complete privacy (queries never leave your network)</li>
          <li>No vendor lock-in</li>
        </ul>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          📖 See <a href="/docs/LOCAL-LLM-RASPBERRY-PI.md" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">setup guide</a> for installation instructions on your ProStat Bridge or Core.
        </p>
      </div>
    </div>
  );
};

const GroqApiKeyInput = () => {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem("groqApiKey") || "";
    } catch {
      return "";
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    } catch {
      return "llama-3.3-70b-versatile";
    }
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState(null);

  // Fetch models from Groq API when API key is available
  useEffect(() => {
    const fetchModels = async () => {
      if (!value || !value.trim()) {
        setAvailableModels([]);
        setModelError(null);
        return;
      }

      setLoadingModels(true);
      setModelError(null);

      try {
        const models = await fetchGroqModels(value);
        
        // Filter out decommissioned models
        const activeModels = models.filter((m) => {
          const decommissioned = ["llama-3.1-70b-versatile"];
          return !decommissioned.includes(m.id);
        });

        setAvailableModels(activeModels);

        // If current model is not available, suggest a new one
        const currentModelExists = activeModels.some((m) => m.id === model);
        if (!currentModelExists && activeModels.length > 0) {
          const suggested = suggestModel(activeModels);
          if (suggested) {
            setModel(suggested);
            localStorage.setItem("groqModel", suggested);
            window.dispatchEvent(new Event("storage"));
          }
        }
      } catch (error) {
        console.error("Failed to fetch Groq models:", error);
        setModelError(error.message);
        // Use fallback model if fetch fails
        setAvailableModels([
          { id: "llama-3.3-70b-versatile", object: "model" },
        ]);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value.trim();
    setValue(val);
    try {
      if (val) {
        localStorage.setItem("groqApiKey", val);
      } else {
        localStorage.removeItem("groqApiKey");
      }
    } catch {}
  };

  const handleModelChange = (e) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    try {
      localStorage.setItem("groqModel", selectedModel);
      // Trigger storage event for other components to pick up the change
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const clearKey = () => {
    setValue("");
    setAvailableModels([]);
    setModelError(null);
    try {
      localStorage.removeItem("groqApiKey");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Groq API Key (Optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={value}
            onChange={handleChange}
            placeholder="gsk_..."
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
            aria-label="Groq API Key"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? "🙈" : "👁️"}
          </button>
          {value && (
            <button
              type="button"
              onClick={clearKey}
              className="px-3 py-2 rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
              aria-label="Clear key"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Model Selector */}
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          AI Model
        </label>
        {loadingModels ? (
          <div className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-500">
            Loading available models...
          </div>
        ) : availableModels.length > 0 ? (
          <>
            <select
              value={model}
              onChange={handleModelChange}
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="Select Groq Model"
            >
              {availableModels.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {formatModelLabel(modelOption.id)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {getModelDescription(model)}
            </p>
          </>
        ) : value ? (
          <div className="w-full p-2 rounded border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300">
            {modelError
              ? `Error loading models: ${modelError}. Using default model.`
              : "Enter your API key above to see available models"}
          </div>
        ) : (
          <div className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
            Enter your API key to see available models
          </div>
        )}
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
          ℹ️ What's this for?
        </p>
        <p className="mb-2">
          Ask Joule can optionally use Groq's LLM API for advanced natural
          language understanding when built-in parsing can't handle complex
          questions.
        </p>
        <p className="mb-2">
          <strong>Get a free key:</strong> Visit{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
          >
            console.groq.com/keys
          </a>
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          🔒 Your API key is stored locally in your browser and never sent to
          our servers. All Groq API calls are made directly from your browser to
          Groq.
        </p>
      </div>
      {value && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={16} />
          <span>
            API key configured with {formatModelLabel(model)} ✓
          </span>
        </div>
      )}
    </div>
  );
};

const UserProfileCard = ({ setToast }) => {
  const [customHeroUrl, setCustomHeroUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await getCustomHeroUrl();
      if (mounted) setCustomHeroUrl(url);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const blob = await resizeToCover(file, {
        width: 1600,
        height: 900,
        type: "image/png",
        quality: 0.92,
      });
      const url = await saveCustomHeroBlob(blob);
      if (url) {
        setCustomHeroUrl(url);
        try {
          localStorage.setItem("onboardingWelcomeTheme", "custom");
        } catch (err) {}
        setToast({ message: "Profile picture saved.", type: "success" });
      }
    } catch (err) {
      setToast({
        message: "Could not process that image. Please try a different file.",
        type: "error",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeProfilePicture = async () => {
    try {
      await deleteCustomHero();
      setCustomHeroUrl(null);
      try {
        localStorage.setItem("onboardingWelcomeTheme", "winter");
      } catch (err) {}
      setToast({ message: "Profile picture removed.", type: "info" });
    } catch (err) {
      setToast({ message: "Failed to remove profile picture.", type: "error" });
    }
  };

  return (
    <Section title="My Profile" icon={<Settings size={20} />}>
      <div className="flex items-center gap-5">
        <div className="w-24 h-24 rounded-full border-2 border-blue-500 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {customHeroUrl ? (
            <img
              src={customHeroUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              ?
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors"
          >
            Upload Picture
          </button>
          {customHeroUrl && (
            <button
              onClick={removeProfilePicture}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
    </Section>
  );
};

const BuildingCharacteristics = ({ settings, onSettingChange, outletContext }) => {
  // Local state for manual heat loss input to allow free editing
  const [manualHeatLossInput, setManualHeatLossInput] = useState(
    String(settings.manualHeatLoss ?? 314)
  );
  
  // Sync local state when settings change externally
  useEffect(() => {
    setManualHeatLossInput(String(settings.manualHeatLoss ?? 314));
  }, [settings.manualHeatLoss]);
  
  const calculatedHeatLossFactor = useMemo(() => {
    const BASE_BTU_PER_SQFT_HEATING = 22.67;
    const ceilingMultiplier = 1 + ((settings.ceilingHeight ?? 8) - 8) * 0.1;
    const designHeatLoss = Math.round(
      (settings.squareFeet ?? 800) *
      BASE_BTU_PER_SQFT_HEATING *
      (settings.insulationLevel ?? 1.0) *
      (settings.homeShape ?? 1.0) *
      ceilingMultiplier
    );
    // Convert to BTU/hr/°F (heat loss factor)
    return Math.round(designHeatLoss / 70);
  }, [settings.squareFeet, settings.insulationLevel, settings.homeShape, settings.ceilingHeight]);

  return (
    <Section title="Building Characteristics" icon={<Home size={20} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
            Home Size (sq ft)
          </label>
          <input
            type="number"
            value={settings.squareFeet ?? 2000}
            onChange={(e) =>
              onSettingChange("squareFeet", Number(e.target.value))
            }
            className={fullInputClasses}
            disabled={settings.useManualHeatLoss}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
            Insulation Quality
          </label>
          <select
            value={settings.insulationLevel ?? 1.0}
            onChange={(e) =>
              onSettingChange("insulationLevel", Number(e.target.value))
            }
            className={fullInputClasses}
            disabled={settings.useManualHeatLoss}
          >
            <option value={1.4}>Poor</option>
            <option value={1.0}>Average</option>
            <option value={0.65}>Good</option>
          </select>
        </div>
      </div>
      
      {/* Heat Loss Source Selection */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-xs font-semibold mb-3 text-gray-600 dark:text-gray-300">
          Heat Loss Source
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Select which heat loss value to use for calculations. Only one option can be active at a time.
        </p>
        
        <div className="space-y-3">
          {/* Manual Entry Option */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!settings.useManualHeatLoss}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    // Uncheck other options
                    onSettingChange("useCalculatedHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useManualHeatLoss", true);
                  } else {
                    // If unchecking, default to calculated
                    onSettingChange("useManualHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", true);
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Manual Entry
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Enter exact heat loss in BTU/hr/°F
              </p>
              {settings.useManualHeatLoss && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      step={1}
                      value={manualHeatLossInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow free editing - update local state immediately
                        setManualHeatLossInput(val);
                        // Only update settings if it's a valid number
                        if (val !== "" && val !== "-") {
                          const numVal = parseFloat(val);
                          if (!isNaN(numVal) && numVal >= 10 && numVal <= 10000) {
                            onSettingChange("manualHeatLoss", numVal);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // On blur, ensure we have a valid value
                        const val = e.target.value.trim();
                        if (val === "" || val === "-") {
                          // If empty, restore to current value or default
                          const restoreVal = settings.manualHeatLoss ?? 314;
                          setManualHeatLossInput(String(restoreVal));
                          onSettingChange("manualHeatLoss", restoreVal);
                          return;
                        }
                        const numVal = parseFloat(val);
                        if (isNaN(numVal) || numVal < 10) {
                          // Too low, set to minimum
                          setManualHeatLossInput("10");
                          onSettingChange("manualHeatLoss", 10);
                        } else if (numVal > 10000) {
                          // Too high, set to maximum
                          setManualHeatLossInput("10000");
                          onSettingChange("manualHeatLoss", 10000);
                        } else {
                          // Valid, ensure it's saved
                          const finalVal = Math.round(numVal);
                          setManualHeatLossInput(String(finalVal));
                          onSettingChange("manualHeatLoss", finalVal);
                        }
                      }}
                      className={fullInputClasses}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      BTU/hr/°F
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Calculated (DoE) Option */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!settings.useCalculatedHeatLoss}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    // Uncheck other options
                    onSettingChange("useManualHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", true);
                  } else {
                    // If unchecking, default to manual if available, otherwise analyzer
                    onSettingChange("useCalculatedHeatLoss", false);
                    if (settings.useManualHeatLoss) {
                      onSettingChange("useManualHeatLoss", true);
                    } else {
                      onSettingChange("useAnalyzerHeatLoss", true);
                    }
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Calculated (Department of Energy Data)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Based on square footage, insulation, home shape, and ceiling height
              </p>
              {settings.useCalculatedHeatLoss && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-mono">
                  Current value: {calculatedHeatLossFactor.toLocaleString()} BTU/hr/°F
                  {calculatedHeatLossFactor > 0 && (
                    <span className="ml-2">
                      ({Math.round(calculatedHeatLossFactor * 70).toLocaleString()} BTU/hr @ 70°F ΔT)
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Analyzer CSV Option */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!settings.useAnalyzerHeatLoss}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    // Uncheck other options
                    onSettingChange("useManualHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", true);
                  } else {
                    // If unchecking, default to calculated
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", true);
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Analyzer Data (CSV Import)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                From System Performance Analyzer CSV file upload
              </p>
              {settings.useAnalyzerHeatLoss && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  {outletContext?.heatLossFactor 
                    ? `Current value: ${Number(outletContext.heatLossFactor).toFixed(1)} BTU/hr/°F`
                    : "No analyzer data available. Upload CSV in System Performance Analyzer first."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};

const CostSettings = ({ settings, onSettingChange }) => (
  <Section title="Cost Settings" icon={<DollarSign size={20} />}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
          Cost per kWh ($)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">$</span>
          <input
            type="number"
            min={0.05}
            max={1.0}
            step={0.01}
            value={settings.utilityCost != null ? Number(settings.utilityCost).toFixed(2) : "0.10"}
            onChange={(e) => {
              const val = Math.min(1.0, Math.max(0.05, Number(e.target.value)));
              const rounded = Math.round(val * 100) / 100;
              onSettingChange("utilityCost", rounded);
            }}
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="0.15"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">/kWh</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Used for budget calculations and cost estimates
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
          Gas Cost per Therm ($)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">$</span>
          <input
            type="number"
            min={0.5}
            max={5.0}
            step={0.01}
            value={settings.gasCost != null ? Number(settings.gasCost).toFixed(2) : "1.20"}
            onChange={(e) => {
              const val = Math.min(5.0, Math.max(0.5, Number(e.target.value)));
              const rounded = Math.round(val * 100) / 100;
              onSettingChange("gasCost", rounded);
            }}
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="1.20"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">/therm</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Used for gas furnace cost comparisons
        </p>
      </div>
    </div>
  </Section>
);

const HvacSystemConfig = ({ settings, onSettingChange, setToast }) => {
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const capacities = { 18: 1.5, 24: 2, 30: 2.5, 36: 3, 42: 3.5, 48: 4, 60: 5 };
  const inputClasses =
    "w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  const selectClasses =
    "w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

  return (
    <Section
      title="HVAC System Configuration"
      icon={<ThermometerSun size={20} />}
    >
      <div className="space-y-4">
        {/* Primary System Selection */}
        <div>
          <p className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">
            Primary Heating System
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Select how your home is heated.
          </p>
          <div className="inline-flex rounded-md overflow-hidden border dark:border-gray-600">
            <button
              onClick={() => onSettingChange("primarySystem", "heatPump")}
              className={`px-4 py-2 text-sm font-semibold flex items-center gap-1 ${
                settings.primarySystem === "heatPump"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              ⚡ Heat Pump
            </button>
            <button
              onClick={() => onSettingChange("primarySystem", "gasFurnace")}
              className={`px-4 py-2 text-sm font-semibold flex items-center gap-1 ${
                settings.primarySystem === "gasFurnace"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              <Flame size={16} /> Gas Furnace
            </button>
          </div>
        </div>

        {/* Heat Pump Configuration */}
        {settings.primarySystem === "heatPump" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Heating Efficiency (HSPF2)
              </label>
              <input
                type="number"
                min={6}
                max={13}
                step={0.1}
                value={settings.hspf2 ?? 8.5}
                onChange={(e) =>
                  onSettingChange(
                    "hspf2",
                    Math.min(13, Math.max(6, Number(e.target.value)))
                  )
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Cooling Efficiency (SEER2)
              </label>
              <input
                type="number"
                min={14}
                max={22}
                step={1}
                value={settings.efficiency ?? 16}
                onChange={(e) =>
                  onSettingChange(
                    "efficiency",
                    Math.min(22, Math.max(14, Number(e.target.value)))
                  )
                }
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Capacity (Tons)
              </label>
              <select
                value={settings.capacity ?? settings.coolingCapacity ?? 36}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onSettingChange("coolingCapacity", v);
                  onSettingChange("capacity", v);
                  setToast?.({
                    message: `Capacity updated: ${capacities[v]} tons (${v}k BTU)`,
                    type: "success",
                  });
                }}
                className={selectClasses}
              >
                {[18, 24, 30, 36, 42, 48, 60].map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}k BTU ({capacities[bt]} tons)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Gas Furnace Configuration */}
        {settings.primarySystem === "gasFurnace" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Furnace AFUE
                </label>
                <button
                  type="button"
                  onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label="What's AFUE?"
                >
                  <HelpCircle size={14} />
                </button>
              </div>

              {showAfueTooltip && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                    What's AFUE?
                  </p>
                  <p className="mb-2">
                    AFUE stands for{" "}
                    <strong>Annual Fuel Utilization Efficiency</strong>. It's
                    like your furnace's "gas mileage."
                  </p>
                  <ul className="space-y-1 ml-4 mb-2">
                    <li>
                      <strong>90-98%:</strong> High-efficiency furnace
                    </li>
                    <li>
                      <strong>80%:</strong> Standard, mid-efficiency
                    </li>
                    <li>
                      <strong>&lt; 80%:</strong> Older, less efficient
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.6}
                  max={0.99}
                  step={0.01}
                  value={settings.afue ?? 0.95}
                  onChange={(e) =>
                    onSettingChange(
                      "afue",
                      Math.min(0.99, Math.max(0.6, Number(e.target.value)))
                    )
                  }
                  className="flex-grow"
                />
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((settings.afue ?? 0.95) * 100)}%
                </span>
              </div>
            </div>

            {/* Cooling System for Gas Furnace */}
            <div>
              <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-300">
                Cooling System
              </p>
              <div className="inline-flex rounded-md overflow-hidden border dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "centralAC")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "centralAC"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <Snowflake size={14} /> Central A/C
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "dualFuel")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "dualFuel"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  ⚡ Dual-Fuel HP
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "none")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "none"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  None/Other
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Section>
  );
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] =
    useState(false);
  const outletCtx = useOutletContext() || {};
  const userSettings = outletCtx.userSettings || {};
  const setUserSetting =
    outletCtx.setUserSetting ||
    ((key, value) => {
      console.warn(`setUserSetting not provided for setting: ${key}`, value);
    });

  return (
    <div className="page-gradient-overlay min-h-screen">
      <div className="settings-page p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="icon-container icon-container-gradient icon-container-lg">
              <Settings className="w-7 h-7" />
            </div>
            <h1 className="heading-primary">
              Settings
            </h1>
          </div>
          <DashboardLink />
        </header>

      <UserProfileCard setToast={setToast} />
      
      {/* Product Tiers Banner */}
      <div className="mb-6 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">ProStat Product Tiers</h3>
          </div>
          <Link
            to="/hardware"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm hover:shadow-md"
          >
            Manage Subscription
            <ExternalLink size={16} />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free Tier */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">Free</h4>
              <span className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">$0</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-semibold">CSV Analyzer</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">For DIY homeowners and one-time analysis</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Manual CSV upload & analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Heat loss calculation (BTU/hr/°F)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">System balance point analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Efficiency percentile ranking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Export results to CSV</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-500 dark:text-gray-500">No automatic monitoring</span>
              </li>
            </ul>
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 italic text-center">You're using this tier</p>
            </div>
          </div>

          {/* Monitor Tier */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border-2 border-blue-400 dark:border-blue-600 p-4 relative flex flex-col">
            <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">POPULAR</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">Monitor</h4>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 leading-tight whitespace-nowrap">$20</span>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">/year</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">ProStat Monitor</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Annual subscription • Automatic cloud monitoring</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Everything in Free tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Automatic daily data collection from Ecobee</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Daily heat loss analysis & trend tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Efficiency score over time</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Alert notifications for changes</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-500 dark:text-gray-500">No hardware control (read-only)</span>
              </li>
            </ul>
            <button 
              onClick={() => navigate("/upgrades?product=monitor&showCart=true")}
              className="mt-auto w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              Subscribe - $20/year
            </button>
          </div>

          {/* Bridge Tier */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border-2 border-amber-400 dark:border-amber-600 p-4 relative flex flex-col">
            <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">PREMIUM</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-gray-900 dark:text-white">Bridge</h4>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 leading-tight whitespace-nowrap">$129</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">ProStat Bridge</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">One-time purchase • Complete control & sovereignty</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Everything in Monitor tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">ProStat Bridge hardware included (pre-configured dedicated logic controller)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Local HomeKit control (works with Siri)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Full thermostat control (setpoints, schedules)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">Works completely offline</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">No cloud dependency</span>
              </li>
            </ul>
            <button 
              onClick={() => navigate("/upgrades?product=bridge&showCart=true")}
              className="mt-auto w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              Buy Now - $129
            </button>
          </div>
        </div>
      </div>

      <BuildingCharacteristics
        settings={userSettings}
        onSettingChange={setUserSetting}
        outletContext={outletCtx}
      />
      <HvacSystemConfig
        settings={userSettings}
        onSettingChange={setUserSetting}
        setToast={setToast}
      />

      <CostSettings
        settings={userSettings}
        onSettingChange={setUserSetting}
      />

      {/* Thermostat Settings */}
      <Section title="Thermostat Settings" icon={<ThermometerSun size={20} />}>
        <ThermostatSettingsPanel />
      </Section>

      {/* ProStat Bridge (HomeKit HAP) - Preferred */}
      <Section title="ProStat Bridge (Local HomeKit)" icon={<ThermometerSun size={20} />}>
        <ProstatBridgeSettings />
      </Section>

      {/* Ecobee Cloud API (Fallback) */}
      <Section title="Ecobee Cloud API (Fallback)" icon={<ThermometerSun size={20} />}>
        <EcobeeSettings />
      </Section>

      {/* Pro Code Section */}
      <Section title="Pro Access" icon={<Crown className="w-5 h-5 text-amber-500" />}>
        <ProCodeInput />
      </Section>

      {/* Advanced Settings Section */}
      <div className="glass-card">
        <button
          onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
          className="w-full p-glass flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="icon-container">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="heading-secondary">
              Advanced Settings
            </h2>
          </div>
          <ChevronRight
            className={`text-gray-500 transition-transform ${
              advancedSettingsExpanded ? "rotate-90" : ""
            }`}
          />
        </button>

        {advancedSettingsExpanded && (
          <div className="p-glass border-t border-gray-200 dark:border-gray-700 space-y-6">
            <Section title="Local LLM (ProStat Bridge/Core)" icon={<Server size={20} />}>
              <LocalLLMSettings />
            </Section>

            <Section title="Groq AI Integration" icon={<Server size={20} />}>
              <GroqApiKeyInput />
            </Section>

            <Section title="Voice Settings" icon={<Mic size={20} />}>
              <div className="space-y-4">
                <VoicePicker />
                <VoiceListenDurationInput />
              </div>
            </Section>

            {/* Detailed Annual Estimate Toggle */}
            <div className="glass-card p-glass">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">
                    Detailed Annual Estimate
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Use month-by-month calculations for more accurate annual
                    estimates
                  </p>
                </div>
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!userSettings.useDetailedAnnualEstimate}
                    onChange={(e) =>
                      setUserSetting(
                        "useDetailedAnnualEstimate",
                        e.target.checked
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {/* Byzantine Mode Easter Egg 🕯️ */}
            <ByzantineModeToggle setToast={setToast} />
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
    </div>
  );
};

export default SettingsPage;
