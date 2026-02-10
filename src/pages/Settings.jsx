import React, { useEffect, useRef, useState, useMemo, Suspense } from "react";
import {
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Plus,
  Edit2,
  Zap,
  Search,
  Info,
  AlertCircle,
  Copy,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  fetchGroqModels,
  suggestModel,
  formatModelLabel,
  getModelDescription,
  getBestModel,
} from "../lib/groqModels";
import { AI_PROVIDERS, fetchOllamaModels } from "../lib/aiProvider";

/** Persist a setting to the bridge so it's available when app runs from bridge origin */
function persistAIConfigToBridge(key, value) {
  try {
    const base = typeof window !== "undefined"
      ? (localStorage.getItem("jouleBridgeUrl") || import.meta.env?.VITE_JOULE_BRIDGE_URL || (window.location?.port === "8080" ? window.location.origin : null) || "")
      : "";
    if (!base) return;
    fetch(`${base}/api/settings/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value ?? "" }),
    }).catch(() => {});
  } catch { /* ignore */ }
}
import { fullInputClasses as _fullInputClasses } from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import { Toast } from "../components/Toast";
import Breadcrumbs from "../components/Breadcrumbs";
import { useOutletContext } from "react-router-dom";
import { resizeToCover } from "../lib/imageProcessing";
import {
  saveCustomHeroBlob,
  getCustomHeroUrl,
  deleteCustomHero,
} from "../lib/userImages";
import ThermostatSettingsPanel from "../components/ThermostatSettingsPanel";
import JouleBridgeSettings from "../components/JouleBridgeSettings";
import BridgeUrlConfig from "../components/BridgeUrlConfig";
import TTSServiceSettings from "../components/TTSServiceSettings";
import StorageUsageIndicator from "../components/StorageUsageIndicator";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import AutoSettingsMathEquations from "../components/AutoSettingsMathEquations";
import { setProCode, clearProCode, hasProAccess } from "../utils/demoMode";
import { getTotalBillDaysEntered, MIN_BILL_DAYS_FOR_LEARNED } from "../utils/billDataUtils";
import "../utils/storageCleanup";
import "../hooks/useAutoSave";
import ValidatedInput from "../components/ValidatedInput";
import UnitSystemToggle from "../components/UnitSystemToggle";
import {
  defaultFixedChargesByState,
  defaultFallbackFixedCharges,
  normalizeStateToAbbreviation,
} from "../data/fixedChargesByState";
import * as heatUtils from "../lib/heatUtils";
import { getStateElectricityRate, getStateGasRate } from "../data/stateRates";
import { getStateCode, fetchLiveElectricityRate, fetchLiveGasRate } from "../lib/eiaRates";

const Section = ({ title, icon, description, children, ...props }) => (
  <div
    className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 space-y-4"
    {...props}
  >
    <div>
      <h2 className="text-[18px] font-medium text-[#E8EDF3] flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            {icon}
          </div>
        )}
        {title}
      </h2>
      {description && (
        <p className="text-xs text-[#A7B0BA] mt-1 mb-3 max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {children}
  </div>
);

const ProCodeInput = () => {
  const [code, setCode] = useState(() => {
    try {
      const stored = localStorage.getItem('proCode');
      // Default to PRO-DEMO if nothing is stored
      return stored || 'PRO-DEMO';
    } catch {
      return 'PRO-DEMO';
    }
  });
  const [proAccess, setProAccess] = useState({ hasAccess: false, source: null });
  const [message, setMessage] = useState('');
  const location = useLocation();

  useEffect(() => {
    // Auto-save PRO-DEMO if no code is stored in localStorage
    try {
      const stored = localStorage.getItem('proCode');
      if (!stored || stored === '') {
        const defaultCode = 'PRO-DEMO';
        setProCode(defaultCode);
        setCode(defaultCode);
      }
    } catch {
      // Ignore localStorage errors
    }
    checkAccess();
  }, []);

  // Scroll to Joule Bridge section when navigated to with #joule-bridge hash
  useEffect(() => {
    if (location.hash === '#joule-bridge') {
      // Scroll to joule-bridge section after a brief delay to ensure it's rendered
      setTimeout(() => {
        const jouleBridgeElement = document.getElementById('joule-bridge');
        if (jouleBridgeElement) {
          jouleBridgeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);

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
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
        <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold mb-1">
          Hardware Owners (Optional)
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Unlock advanced analysis and local AI features included with Joule hardware.
        </p>
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
            placeholder="Enter code from device"
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono uppercase"
            aria-label="Pro Code"
          />
          <button
            type="button"
            onClick={handleSetCode}
            className="px-4 py-2 bg-[#1E4CFF] hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-semibold"
          >
            Save
          </button>
          {code && (
            <button
              type="button"
              onClick={handleClearCode}
              className="px-3 py-2 rounded-lg border border-red-500/50 hover:bg-red-500/10 text-sm text-red-400 hover:text-red-300 transition-colors"
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
                Unlocked via {proAccess.source === 'bridge' ? 'Joule Bridge hardware' : 'Pro code'}
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
        className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Voice persona selection"
      >
        <option value="">Default (Auto-select best voice)</option>
        {availableVoices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {getVoiceLabel(voice)}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed">
        Choose a voice for Ask Joule. British English voices sound more formal and authoritative (JARVIS-like).
      </p>
    </div>
  );
};

const DeleteAllDataButton = ({ setToast }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      // Clear all localStorage data
      localStorage.clear();
      
      // Clear IndexedDB if available
      if (typeof window !== "undefined" && window.indexedDB) {
        try {
          const databases = await window.indexedDB.databases();
          for (const db of databases) {
            if (db.name) {
              const deleteReq = window.indexedDB.deleteDatabase(db.name);
              await new Promise((resolve, reject) => {
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
                deleteReq.onblocked = () => resolve(); // Continue even if blocked
              });
            }
          }
        } catch (error) {
          console.warn("Failed to clear IndexedDB:", error);
        }
      }

      setToast?.({ 
        message: "All data has been deleted. The page will reload.", 
        type: "success" 
      });

      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to delete all data:", error);
      setToast?.({ 
        message: "Failed to delete all data. Please try again.", 
        type: "error" 
      });
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white rounded-lg font-semibold transition-colors"
        >
          Delete All Data
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-red-400">
            Are you absolutely sure? This cannot be undone!
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-600 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors border border-red-500/50"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed text-[#E8EDF3] rounded-lg font-semibold transition-colors border border-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TTSEngineToggle = () => {
  const [useBrowserTTS, setUseBrowserTTS] = useState(() => {
    try {
      return localStorage.getItem("useBrowserTTS") === "true";
    } catch {
      return false; // Default to premium TTS (if available)
    }
  });

  const handleToggle = (e) => {
    const useBrowser = e.target.checked;
    setUseBrowserTTS(useBrowser);
    try {
      localStorage.setItem("useBrowserTTS", useBrowser.toString());
      // Dispatch event to notify other components
      window.dispatchEvent(new Event("ttsEngineChanged"));
    } catch (err) {
      console.warn("Failed to save TTS engine preference:", err);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useBrowserTTS}
          onChange={handleToggle}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Use Browser TTS (instead of Premium TTS)
        </span>
      </label>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
        {useBrowserTTS
          ? "Using browser's built-in text-to-speech. Free and unlimited."
          : "Using premium TTS service (ElevenLabs) - requires monthly subscription. High-quality voice synthesis with natural-sounding speech."}
      </p>
    </div>
  );
};

export const VoiceListenDurationInput = () => {
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
    } catch { /* ignore */ }
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
      <p className="text-xs text-[#7C8894] max-w-md">
        (How long voice input listens before auto-stopping)
      </p>
    </div>
  );
};

const FunSafeModeToggle = () => {
  const [funSafeMode, setFunSafeMode] = useState(() => {
    try {
      return localStorage.getItem("funSafeMode") !== "false";
    } catch {
      return true; // Default to safe mode
    }
  });

  const handleToggle = (e) => {
    const isSafe = e.target.checked;
    setFunSafeMode(isSafe);
    try {
      if (isSafe) {
        localStorage.removeItem("funSafeMode"); // Remove or set to anything but "false"
      } else {
        localStorage.setItem("funSafeMode", "false");
      }
    } catch (err) {
      console.warn("Failed to save fun safe mode preference:", err);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={funSafeMode}
          onChange={handleToggle}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Fun Safe Mode (Family-Friendly Responses)
        </span>
      </label>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-7">
        {funSafeMode
          ? "Using toned-down, family-friendly responses. Disable for full-strength chaotic Joule humor (PG-13)."
          : "Full-strength chaotic Joule enabled. Responses may include PG-13 humor and references."}
      </p>
    </div>
  );
};

// Zone Management Component
const ZoneManagementSection = ({ setToast }) => {
  const [zones, setZones] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("zones") || "[]");
    } catch {
      return [];
    }
  });
  const [activeZoneId, setActiveZoneId] = useState(() => {
    try {
      return localStorage.getItem("activeZoneId") || (zones.length > 0 ? zones[0].id : "zone1");
    } catch {
      return "zone1";
    }
  });
  const [editingZone, setEditingZone] = useState(null);

  // Read home settings from localStorage for zone defaults
  const homeSettings = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userSettings") || "{}");
    } catch { return {}; }
  }, []);

  // Initialize default zone if empty
  useEffect(() => {
    if (zones.length === 0) {
      const defaultZone = {
        id: "zone1",
        name: "Main Zone",
        squareFeet: homeSettings?.squareFeet || 800,
        insulationLevel: homeSettings?.insulationLevel || 1.0,
        primarySystem: homeSettings?.primarySystem || "heatPump",
        capacity: homeSettings?.capacity || 36,
        hasCSV: false,
      };
      setZones([defaultZone]);
      localStorage.setItem("zones", JSON.stringify([defaultZone]));
      localStorage.setItem("activeZoneId", defaultZone.id);
    }
  }, []);

  // Keep single-zone squareFeet in sync with home size setting
  useEffect(() => {
    if (zones.length === 1 && homeSettings?.squareFeet && zones[0].squareFeet !== homeSettings.squareFeet) {
      const updatedZone = { ...zones[0], squareFeet: homeSettings.squareFeet };
      setZones([updatedZone]);
      localStorage.setItem("zones", JSON.stringify([updatedZone]));
    }
  }, [homeSettings?.squareFeet]);

  const addZone = () => {
    const newZone = {
      id: `zone${zones.length + 1}`,
      name: `Zone ${zones.length + 1}`,
      squareFeet: 1000,
      insulationLevel: 1.0,
      primarySystem: "heatPump",
      capacity: 24,
      hasCSV: false,
    };
    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
  };

  const removeZone = (zoneId) => {
    if (zones.length <= 1) {
      setToast?.({ message: "You must have at least one zone", type: "error" });
      return;
    }
    const updatedZones = zones.filter(z => z.id !== zoneId);
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
    
    // Clean up zone-specific localStorage data
    const keysToRemove = [
      'spa_resultsHistory',
      'spa_parsedCsvData',
      'spa_labels',
      'spa_diagnostics',
      'spa_filename',
      'spa_uploadTimestamp'
    ];
    keysToRemove.forEach(key => {
      localStorage.removeItem(`${key}_${zoneId}`);
    });
    
    // Switch to first zone if active zone was deleted
    if (activeZoneId === zoneId && updatedZones.length > 0) {
      setActiveZoneId(updatedZones[0].id);
      localStorage.setItem("activeZoneId", updatedZones[0].id);
    }
  };

  const updateZone = (zoneId, updates) => {
    const updatedZones = zones.map(z => 
      z.id === zoneId ? { ...z, ...updates } : z
    );
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
    setEditingZone(null);
  };

  const checkZoneHasCSV = (zoneId) => {
    try {
      const hasData = localStorage.getItem(`spa_parsedCsvData_${zoneId}`);
      return !!hasData;
    } catch {
      return false;
    }
  };

  // Update hasCSV flags
  useEffect(() => {
    const updatedZones = zones.map(z => ({
      ...z,
      hasCSV: checkZoneHasCSV(z.id)
    }));
    if (JSON.stringify(updatedZones) !== JSON.stringify(zones)) {
      setZones(updatedZones);
      localStorage.setItem("zones", JSON.stringify(updatedZones));
    }
  }, []);

  return (
    <Section title="Zone Management" icon={<Home size={20} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          If you have more than one thermostat, set up a zone for each one.
          Zones let Joule analyze each area separately — they <strong>do not</strong> control how your thermostats behave.
        </p>
        
        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {editingZone?.id === zone.id ? (
                      <input
                        type="text"
                        value={editingZone.name}
                        onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
                        onBlur={() => {
                          if (editingZone.name.trim()) {
                            updateZone(zone.id, { name: editingZone.name.trim() });
                          } else {
                            setEditingZone(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingZone.name.trim()) {
                              updateZone(zone.id, { name: editingZone.name.trim() });
                            }
                          } else if (e.key === "Escape") {
                            setEditingZone(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        {zone.name}
                        {zone.id === activeZoneId && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {zone.hasCSV && (
                    <span className="text-xs text-green-600 dark:text-green-400">✓ CSV</span>
                  )}
                  <button
                    onClick={() => setEditingZone({ ...zone })}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    title="Edit zone name"
                  >
                    <Edit2 size={16} />
                  </button>
                  {zones.length > 1 && (
                    <button
                      onClick={() => removeZone(zone.id)}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      title="Remove zone"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">Size:</span> {zone.squareFeet} sq ft
                </div>
                <div>
                  <span className="font-medium">Capacity:</span> {zone.capacity || "N/A"} kBTU
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addZone}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E4CFF] hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus size={18} />
          Add Zone / Thermostat
        </button>

        <p className="text-xs text-[#A7B0BA] max-w-2xl leading-relaxed italic">
          If you have multiple thermostats, create a zone for each one. You can upload data for each zone separately in the System Performance Analyzer.
        </p>
      </div>
    </Section>
  );
};

const GroqApiKeyInput = () => {
  const [aiProvider, setAiProvider] = useState(() => {
    try {
      return localStorage.getItem("aiProvider") || AI_PROVIDERS.GROQ;
    } catch {
      return AI_PROVIDERS.GROQ;
    }
  });
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
  const [localBaseUrl, setLocalBaseUrl] = useState(() => {
    try {
      return localStorage.getItem("localAIBaseUrl") || "http://192.168.0.108:11434/v1";
    } catch {
      return "http://192.168.0.108:11434/v1";
    }
  });
  const [localModel, setLocalModel] = useState(() => {
    try {
      return localStorage.getItem("localAIModel") || "llama3:latest";
    } catch {
      return "llama3:latest";
    }
  });
  const [localModels, setLocalModels] = useState([]);
  const [loadingLocalModels, setLoadingLocalModels] = useState(false);
  const [localModelsError, setLocalModelsError] = useState(null);
  const [showWhatsThisFor, setShowWhatsThisFor] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [ollamaStepModal, setOllamaStepModal] = useState(null); // 'download' | 'run-linux' | 'run-windows' | 'pull'
  const [ollamaLocation, setOllamaLocation] = useState(() => {
    try {
      const url = localStorage.getItem("localAIBaseUrl") || "";
      return url.includes("localhost") || url.includes("127.0.0.1") ? "this-device" : "other-device";
    } catch {
      return "other-device";
    }
  });

  const copyToClipboard = (text, label, stepKey) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          setCopyFeedback(label);
          setTimeout(() => setCopyFeedback(""), 2000);
          if (stepKey) setOllamaStepModal(stepKey);
        },
        () => setCopyFeedback("")
      );
    }
  };

  // Listen for API key updates from Ask Joule or other components
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const newValue = localStorage.getItem("groqApiKey") || "";
        setValue((prevValue) => {
          // Only update if value actually changed
          return newValue !== prevValue ? newValue : prevValue;
        });
      } catch {
        // Ignore errors
      }
    };

    const handleApiKeyUpdate = (e) => {
      const newKey = e.detail?.apiKey || "";
      if (newKey) {
        setValue((prevValue) => {
          // Only update if value actually changed
          return newKey !== prevValue ? newKey : prevValue;
        });
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener("storage", handleStorageChange);
    
    // Listen for custom events (from same tab - Ask Joule)
    window.addEventListener("groqApiKeyUpdated", handleApiKeyUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("groqApiKeyUpdated", handleApiKeyUpdate);
    };
  }, []); // Empty dependency array - only set up listeners once

  const handleProviderChange = (newProvider) => {
    setAiProvider(newProvider);
    try {
      localStorage.setItem("aiProvider", newProvider);
      persistAIConfigToBridge("aiProvider", newProvider);
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { detail: { apiKey: "" } }));
    } catch { /* ignore */ }
  };

  const handleLocalBaseUrlChange = (e) => {
    const v = e.target.value.trim();
    const def = "http://192.168.0.108:11434/v1";
    setLocalBaseUrl(v || def);
    try {
      const val = v || def;
      localStorage.setItem("localAIBaseUrl", val);
      persistAIConfigToBridge("localAIBaseUrl", val);
      window.dispatchEvent(new Event("storage"));
    } catch { /* ignore */ }
  };

  const handleLocalModelChange = (e) => {
    const v = e.target.value;
    setLocalModel(v);
    try {
      localStorage.setItem("localAIModel", v);
      persistAIConfigToBridge("localAIModel", v);
      window.dispatchEvent(new Event("storage"));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (aiProvider !== AI_PROVIDERS.LOCAL) return;
    const base = (localBaseUrl || "http://192.168.0.108:11434/v1").trim();
    if (!base) return;
    let cancelled = false;
    setLoadingLocalModels(true);
    setLocalModels([]);
    setLocalModelsError(null);
    fetchOllamaModels(base)
      .then((models) => {
        if (!cancelled) {
          setLocalModels(models);
          setLocalModelsError(null);
          const currentExists = models.some((m) => m.id === localModel);
          if (models.length > 0 && !currentExists) {
            const first = models[0].id;
            setLocalModel(first);
            try {
              localStorage.setItem("localAIModel", first);
              persistAIConfigToBridge("localAIModel", first);
              window.dispatchEvent(new Event("storage"));
            } catch { /* ignore */ }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLocalModels([]);
          setLocalModelsError(err?.message || "Connection failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLocalModels(false);
      });
    return () => { cancelled = true; };
  }, [aiProvider, localBaseUrl]);

  // Fetch models from Groq API when API key is available and provider is Groq
  useEffect(() => {
    const fetchModels = async () => {
      if (aiProvider !== AI_PROVIDERS.GROQ || !value?.trim()) {
        setAvailableModels([]);
        setModelError(null);
        return;
      }

      setLoadingModels(true);
      setModelError(null);

      try {
        const models = await fetchGroqModels(value);
        
        // Filter out decommissioned models
        // Note: Models are fetched dynamically from Groq API, so deprecated models
        // should already be excluded. This is a safety filter.
        const activeModels = models.filter((m) => {
          const decommissioned = ["llama-3.1-70b-versatile"]; // Add more as they're deprecated
          return !decommissioned.includes(m.id);
        });

        setAvailableModels(activeModels);

        // Use dynamic best model selection if no model is set or current model is unavailable
        const currentModelExists = activeModels.some((m) => m.id === model);
        if (!currentModelExists && activeModels.length > 0) {
          // Try dynamic best model selection first
          try {
            const bestModel = await getBestModel(value);
            if (bestModel) {
              setModel(bestModel);
              localStorage.setItem("groqModel", bestModel);
              window.dispatchEvent(new Event("storage"));
            } else {
              // Fallback to suggestModel if getBestModel returns null
              const suggested = suggestModel(activeModels);
              if (suggested) {
                setModel(suggested);
                localStorage.setItem("groqModel", suggested);
                window.dispatchEvent(new Event("storage"));
              }
            }
          } catch (error) {
            console.warn("[Settings] Failed to get best model, using suggestModel:", error);
            // Fallback to suggestModel
            const suggested = suggestModel(activeModels);
            if (suggested) {
              setModel(suggested);
              localStorage.setItem("groqModel", suggested);
              window.dispatchEvent(new Event("storage"));
            }
          }
        } else if (!model || model === "llama-3.3-70b-versatile") {
          // If using default, try to get best model dynamically
          try {
            const bestModel = await getBestModel(value);
            if (bestModel && bestModel !== "llama-3.3-70b-versatile") {
              setModel(bestModel);
              localStorage.setItem("groqModel", bestModel);
              window.dispatchEvent(new Event("storage"));
            }
          } catch (error) {
            // Silently fail - keep default
            console.warn("[Settings] Failed to get best model:", error);
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
  }, [aiProvider, value]);

  const handleChange = (e) => {
    const val = e.target.value.trim();
    setValue(val);
    try {
      if (val) {
        localStorage.setItem("groqApiKey", val);
        persistAIConfigToBridge("groqApiKey", val);
        // Dispatch custom event for same-tab sync (Ask Joule)
        window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { 
          detail: { apiKey: val } 
        }));
      } else {
        localStorage.removeItem("groqApiKey");
        persistAIConfigToBridge("groqApiKey", "");
        // Dispatch custom event when key is cleared
        window.dispatchEvent(new CustomEvent("groqApiKeyUpdated", { 
          detail: { apiKey: "" } 
        }));
      }
      // Also dispatch storage event for cross-tab sync
      window.dispatchEvent(new Event("storage"));
    } catch { /* ignore */ }
  };

  const handleModelChange = (e) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    try {
      localStorage.setItem("groqModel", selectedModel);
      // Clear fallback state when user manually changes model
      import("../lib/groqModelFallback.js").then(({ clearFallbackState }) => {
        clearFallbackState();
      });
      // Trigger storage event for other components to pick up the change
      window.dispatchEvent(new Event("storage"));
    } catch { /* ignore */ }
  };

  const clearKey = () => {
    setValue("");
    setAvailableModels([]);
    setModelError(null);
    try {
      localStorage.removeItem("groqApiKey");
      persistAIConfigToBridge("groqApiKey", "");
    } catch { /* ignore */ }
  };

  const isConfigured = aiProvider === AI_PROVIDERS.GROQ
    ? !!value?.trim()
    : !!localBaseUrl?.trim() && localModels.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          AI Provider
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="aiProvider"
              checked={aiProvider === AI_PROVIDERS.GROQ}
              onChange={() => handleProviderChange(AI_PROVIDERS.GROQ)}
              className="rounded-full"
            />
            <span className="text-sm">Groq Cloud</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="aiProvider"
              checked={aiProvider === AI_PROVIDERS.LOCAL}
              onChange={() => handleProviderChange(AI_PROVIDERS.LOCAL)}
              className="rounded-full"
            />
            <span className="text-sm">Local (Ollama)</span>
          </label>
        </div>
      </div>

      {aiProvider === AI_PROVIDERS.GROQ && (
      <>
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
            className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm text-[#E8EDF3] transition-colors"
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
      </>
      )}

      {aiProvider === AI_PROVIDERS.LOCAL && (
        <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Do this once: install Ollama, start it, then download a model. Use the buttons below.
      </p>
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Where is Ollama running?
        </label>
        <div className="flex flex-wrap gap-4 mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ollamaLocation"
              checked={ollamaLocation === "this-device"}
              onChange={() => {
                setOllamaLocation("this-device");
                const url = "http://localhost:11434/v1";
                setLocalBaseUrl(url);
                try {
                  localStorage.setItem("localAIBaseUrl", url);
                  persistAIConfigToBridge("localAIBaseUrl", url);
                  window.dispatchEvent(new Event("storage"));
                } catch { /* ignore */ }
              }}
              className="rounded-full"
            />
            <span className="text-sm">On this device</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ollamaLocation"
              checked={ollamaLocation === "other-device"}
              onChange={() => {
                setOllamaLocation("other-device");
                const url = localBaseUrl && !localBaseUrl.includes("localhost") && !localBaseUrl.includes("127.0.0.1") ? localBaseUrl : "http://192.168.0.108:11434/v1";
                setLocalBaseUrl(url);
                try {
                  localStorage.setItem("localAIBaseUrl", url);
                  persistAIConfigToBridge("localAIBaseUrl", url);
                  window.dispatchEvent(new Event("storage"));
                } catch { /* ignore */ }
              }}
              className="rounded-full"
            />
            <span className="text-sm">On another device or shared server (local IP or public URL)</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Address of the computer running Ollama
        </label>
        <input
          type="url"
          value={localBaseUrl}
          onChange={handleLocalBaseUrlChange}
          placeholder={ollamaLocation === "this-device" ? "http://localhost:11434/v1" : "http://192.168.0.108:11434/v1"}
          className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono"
          aria-label="Address of computer running Ollama"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {ollamaLocation === "this-device"
            ? "Usually leave as is when Ollama runs on this device."
            : "Enter the address: a local IP (e.g. 192.168.0.108) for same Wi‑Fi, or a public URL (ngrok/Cloudflare Tunnel) for off-network access."}
        </p>
        {ollamaLocation === "other-device" && (
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              <strong>Same network:</strong> On the device running Ollama, run <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">ipconfig</code> (Windows), <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">hostname -I</code> or <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">ip addr</code> (Linux), or System Settings → Network (Mac). Use the IPv4 address (e.g. 192.168.0.108). Add <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">/v1</code> (e.g. http://192.168.0.108:11434/v1).
            </p>
            <p>
              <strong>Shared server (off-network):</strong> If someone hosts a shared Joule LLM server, they can give you a public URL. See <Link to="/docs/SHARED-LLM-SERVER.md" className="text-blue-600 dark:text-blue-400 hover:underline">Shared LLM Server guide</Link> for setup.
            </p>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Model to use
        </label>
        {loadingLocalModels ? (
          <div className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-500">
            Connecting…
          </div>
        ) : localModels.length > 0 ? (
          <select
            value={localModel}
            onChange={handleLocalModelChange}
            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            aria-label="Select model"
          >
            {localModels.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        ) : (
          <div className="w-full p-3 rounded border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200 space-y-2">
            <p className="font-medium">Can’t connect to Ollama.</p>
            <p>Is it running on the computer you chose above? Use the three steps below: install Ollama, start it (so your phone can use it if needed), then download the model once.</p>
            {localModelsError && (
              <p className="text-xs opacity-90 mt-1">Details: {localModelsError}</p>
            )}
          </div>
        )}
      </div>
        </>
      )}

      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <button
          type="button"
          onClick={() => setShowWhatsThisFor(!showWhatsThisFor)}
          className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300 mb-2 hover:underline"
          aria-expanded={showWhatsThisFor}
        >
          {showWhatsThisFor ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          ℹ️ What&apos;s this for?
        </button>
        {showWhatsThisFor && (
          <p className="mb-3 pl-5">
            Ask Joule uses an LLM for natural language understanding when built-in parsing can&apos;t handle complex questions.
          </p>
        )}
        {aiProvider === AI_PROVIDERS.GROQ && (
          <div className="flex flex-wrap gap-2 mb-2">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700/50 text-sm font-medium"
            >
              <ExternalLink size={14} />
              Get Groq API key
            </a>
          </div>
        )}
        {aiProvider === AI_PROVIDERS.LOCAL && (
          <div className="space-y-2 mb-2">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Setup (do in order):</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOllamaStepModal("download")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700/50 text-sm font-medium"
              >
                <ExternalLink size={14} />
                1. Install Ollama
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(
                  '$env:OLLAMA_HOST="0.0.0.0"; $env:OLLAMA_ORIGINS="*"; ollama serve',
                  "Run command (Windows) copied",
                  "run-windows"
                )}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/50 text-sm font-medium"
              >
                <Copy size={14} />
                {copyFeedback === "Run command (Windows) copied" ? "Copied!" : "2. Start Ollama (Windows)"}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(
                  "OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=* ollama serve",
                  "Run command (Linux/Mac) copied",
                  "run-linux"
                )}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/50 text-sm font-medium"
              >
                <Copy size={14} />
                {copyFeedback === "Run command (Linux/Mac) copied" ? "Copied!" : "2. Start Ollama (Mac/Linux)"}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(
                  "ollama pull llama3:latest",
                  "Pull command copied",
                  "pull"
                )}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600/50 text-sm font-medium"
              >
                <Copy size={14} />
                {copyFeedback === "Pull command copied" ? "Copied!" : "3. Download model (one time)"}
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          🔒 All AI calls run from your browser. Groq keys stay local; local AI never leaves your machine.
        </p>
      </div>

      {ollamaStepModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-labelledby="ollama-step-title"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-600">
            {ollamaStepModal === "download" && (
              <>
                <h3 id="ollama-step-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                  1. Install Ollama
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                  On the computer that will run Ollama, go to ollama.com and install it. That’s it for this step.
                </p>
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm"
                >
                  <ExternalLink size={14} />
                  Go to ollama.com
                </a>
              </>
            )}
            {ollamaStepModal === "run-linux" && (
              <>
                <h3 id="ollama-step-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                  2. Start Ollama (Mac / Linux)
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  So other devices (e.g. your phone) can use this PC’s AI, Ollama must listen on all interfaces. The command is in your clipboard.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  <strong>Mac or Linux (run in Terminal):</strong> Open Terminal on that computer, paste (Cmd+V or Ctrl+V), press Enter. Leave the window open so Ollama keeps running.
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-3 p-2 bg-slate-100 dark:bg-slate-700 rounded">
                  <code className="flex-1 min-w-0 text-xs break-all">
                    OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=* ollama serve
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS=* ollama serve", "Run command (Linux/Mac) copied", null)}
                    className="shrink-0 px-2 py-1.5 rounded border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-3 mb-1">Linux only — Ollama runs as a service (persists after reboot):</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  On the Linux PC, run these in a terminal so Ollama accepts connections from other devices and survives restarts:
                </p>
                <div className="space-y-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-slate-100 dark:bg-slate-700 rounded">
                    <code className="flex-1 min-w-0 text-xs break-all">
                      sudo mkdir -p /etc/systemd/system/ollama.service.d/
                    </code>
                    <button type="button" onClick={() => copyToClipboard("sudo mkdir -p /etc/systemd/system/ollama.service.d/", "Linux mkdir copied", null)} className="shrink-0 px-2 py-1 rounded border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs">Copy</button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-slate-100 dark:bg-slate-700 rounded">
                    <code className="flex-1 min-w-0 text-xs break-all">
                      printf &apos;[Service]\nEnvironment=&quot;OLLAMA_HOST=0.0.0.0&quot;\nEnvironment=&quot;OLLAMA_ORIGINS=*&quot;\n&apos; | sudo tee /etc/systemd/system/ollama.service.d/override.conf
                    </code>
                    <button type="button" onClick={() => copyToClipboard('printf \'[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"\n\' | sudo tee /etc/systemd/system/ollama.service.d/override.conf', "Linux override copied", null)} className="shrink-0 px-2 py-1 rounded border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs">Copy</button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap p-2 bg-slate-100 dark:bg-slate-700 rounded">
                    <code className="flex-1 min-w-0 text-xs break-all">
                      sudo systemctl daemon-reload &amp;&amp; sudo systemctl restart ollama
                    </code>
                    <button type="button" onClick={() => copyToClipboard("sudo systemctl daemon-reload && sudo systemctl restart ollama", "Linux restart copied", null)} className="shrink-0 px-2 py-1 rounded border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs">Copy</button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If your distro uses a firewall, allow port 11434 from your LAN (e.g. <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">sudo ufw allow 11434/tcp</code> then <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">sudo ufw reload</code>).
                </p>
              </>
            )}
            {ollamaStepModal === "run-windows" && (
              <>
                <h3 id="ollama-step-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                  2. Start Ollama (Windows)
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  You need <strong>PowerShell</strong> (not Command Prompt). If you get a syntax error, you’re in the wrong window — use the option below or open PowerShell from the Start menu.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                  <strong>Easiest:</strong> Press <strong>Win+R</strong>, paste the command below, press Enter. A PowerShell window will open and start Ollama. Leave it open.
                </p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <code className="flex-1 min-w-0 text-xs bg-slate-200 dark:bg-slate-600 rounded px-2 py-1.5 break-all">
                    powershell -NoExit -Command &quot;$env:OLLAMA_HOST=&#39;0.0.0.0&#39;; $env:OLLAMA_ORIGINS=&#39;*&#39;; ollama serve&quot;
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("powershell -NoExit -Command \"$env:OLLAMA_HOST='0.0.0.0'; $env:OLLAMA_ORIGINS='*'; ollama serve\"", "Open PowerShell + serve copied", null)}
                    className="shrink-0 px-2 py-1.5 rounded border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-800/50"
                  >
                    {copyFeedback === "Open PowerShell + serve copied" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Or in PowerShell: paste (Ctrl+V) the command you already copied, then Enter.</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Using Command Prompt? Copy and run this there:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="flex-1 min-w-0 text-xs bg-slate-200 dark:bg-slate-600 rounded px-2 py-1.5 break-all">
                    set OLLAMA_HOST=0.0.0.0 &amp;&amp; set OLLAMA_ORIGINS=* &amp;&amp; ollama serve
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("set OLLAMA_HOST=0.0.0.0 && set OLLAMA_ORIGINS=* && ollama serve", "Command Prompt command copied", null)}
                    className="shrink-0 px-2 py-1.5 rounded border border-slate-500 dark:border-slate-400 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    {copyFeedback === "Command Prompt command copied" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </>
            )}
            {ollamaStepModal === "pull" && (
              <>
                <h3 id="ollama-step-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                  3. Download the model (one time)
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  The command is in your clipboard. On the <strong>same computer</strong> where Ollama is running, open a <strong>new</strong> PowerShell (or Terminal on Mac/Linux), paste (Ctrl+V), press Enter. Wait until it finishes.
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Or press <strong>Win+R</strong>, paste the command below, press Enter.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="flex-1 min-w-0 text-xs bg-slate-200 dark:bg-slate-600 rounded px-2 py-1.5 break-all">
                    powershell -NoExit -Command &quot;ollama pull llama3:latest&quot;
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("powershell -NoExit -Command \"ollama pull llama3:latest\"", "Open PowerShell + pull copied", null)}
                    className="shrink-0 px-2 py-1.5 rounded border border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-800/50"
                  >
                    {copyFeedback === "Open PowerShell + pull copied" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setOllamaStepModal(null)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {isConfigured && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={16} />
          <span>
            {aiProvider === AI_PROVIDERS.GROQ
              ? `Groq configured with ${formatModelLabel(model)} ✓`
              : `Local AI connected — using ${localModel} ✓`}
          </span>
        </div>
      )}
      {aiProvider === AI_PROVIDERS.LOCAL && localBaseUrl?.trim() && !isConfigured && !loadingLocalModels && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          ⚠️ Base URL set, but not connected. Fix the issues above.
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
        } catch { /* ignore */ }
        setToast({ message: "Profile picture saved.", type: "success" });
      }
    } catch {
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
      } catch { /* ignore */ }
      setToast({ message: "Profile picture removed.", type: "info" });
    } catch {
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
    const designHeatLoss = heatUtils.calculateHeatLoss({
      squareFeet: settings.squareFeet ?? 800,
      insulationLevel: settings.insulationLevel ?? 1.0,
      homeShape: settings.homeShape ?? 1.0,
      ceilingHeight: settings.ceilingHeight ?? 8,
      wallHeight: settings.wallHeight ?? null,
      hasLoft: settings.hasLoft ?? false,
    });
    // Convert to BTU/hr/°F (heat loss factor)
    return Math.round(designHeatLoss / 70);
  }, [settings.squareFeet, settings.insulationLevel, settings.homeShape, settings.ceilingHeight, settings.wallHeight, settings.hasLoft]);

  return (
    <Section title="Building Characteristics" icon={<Home size={20} />}>
      <p className="text-xs text-[#A7B0BA] mb-4 italic">
        These settings describe your home's construction. Joule uses them to estimate heat loss — they don't affect how your system runs day-to-day.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Home Size (sq ft)
          </label>
          <input
            type="number"
            min={100}
            max={50000}
            step={1}
            placeholder="Enter square footage"
            value={settings.squareFeet ?? 2000}
            onChange={(e) => {
              const val = e.target.value;
              // Allow empty input while typing
              if (val === "" || val === "-") {
                onSettingChange("squareFeet", null);
                return;
              }
              const numVal = Number(val);
              if (!isNaN(numVal) && numVal >= 100 && numVal <= 50000) {
                onSettingChange("squareFeet", Math.round(numVal));
              }
            }}
            onBlur={(e) => {
              // Ensure we have a valid value on blur
              const val = e.target.value.trim();
              if (val === "" || val === "-" || isNaN(Number(val))) {
                onSettingChange("squareFeet", settings.squareFeet ?? 2000);
              } else {
                const numVal = Number(val);
                if (numVal < 100) {
                  onSettingChange("squareFeet", 100);
                } else if (numVal > 50000) {
                  onSettingChange("squareFeet", 50000);
                } else {
                  onSettingChange("squareFeet", Math.round(numVal));
                }
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          />
          {settings.useManualHeatLoss && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Disabled when using manual heat loss entry
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Insulation Quality
          </label>
          <div className="flex gap-2">
            <select
              value={[1.4, 1.0, 0.65].includes(settings.insulationLevel ?? 1.0) ? (settings.insulationLevel ?? 1.0) : "custom"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  // Keep current custom value, just show input
                  return;
                }
                onSettingChange("insulationLevel", Number(val));
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={settings.useManualHeatLoss}
            >
              <option value={1.4}>Poor (pre-1980, minimal upgrades) - 1.4×</option>
              <option value={1.0}>Average (1990s-2000s, code-min) - 1.0×</option>
              <option value={0.65}>Good (post-2010, ENERGY STAR) - 0.65×</option>
              <option value="custom">Custom value...</option>
            </select>
            {(![1.4, 1.0, 0.65].includes(settings.insulationLevel ?? 1.0)) && (
              <input
                type="number"
                min={0.1}
                max={2.0}
                step={0.05}
                value={settings.insulationLevel ?? 1.0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val >= 0.1 && val <= 2.0) {
                    onSettingChange("insulationLevel", val);
                  }
                }}
                className="w-24 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={settings.useManualHeatLoss}
                placeholder="Custom"
              />
            )}
          </div>
          <p className="text-xs text-[#A7B0BA] mt-1.5 max-w-md">
            <strong>Current:</strong> {settings.insulationLevel?.toFixed(2) ?? "1.00"}× (lower = better insulation). Values &lt;0.65 (e.g., 0.50×) are very aggressive and may not account for real-world infiltration/window losses that DOE includes. For typical homes, 0.70-0.80× is more realistic than 0.50×.
          </p>
        </div>
      </div>
      
      {/* Building Shape and Ceiling Height */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Building Shape
          </label>
          <select
            value={settings.homeShape ?? 1.0}
            onChange={(e) => {
              const newShape = Number(e.target.value);
              onSettingChange("homeShape", newShape);
              // Auto-set sensible wall height default when switching to Cabin
              if (newShape >= 1.2 && newShape < 1.3 && !settings.wallHeight) {
                onSettingChange("wallHeight", 8);
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          >
            <option value={0.9}>Two-Story (less exterior surface)</option>
            <option value={1.0}>Split-Level / Standard</option>
            <option value={1.1}>Ranch / Single-Story (more exterior surface)</option>
            <option value={1.15}>Manufactured Home</option>
            <option value={1.2}>Cabin</option>
          </select>
          <p className="text-xs text-[#A7B0BA] mt-1.5">
            Affects surface area exposure and heat loss. Single-story homes have more roof/floor area per square foot.
          </p>
          {/* Loft toggle - only show for Cabin */}
          {(settings.homeShape ?? 1.0) >= 1.2 && (settings.homeShape ?? 1.0) < 1.3 && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="hasLoft"
                checked={settings.hasLoft ?? false}
                onChange={(e) => onSettingChange("hasLoft", e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={settings.useManualHeatLoss}
              />
              <label htmlFor="hasLoft" className="text-sm text-[#E8EDF3] cursor-pointer">
                Has Loft
              </label>
            </div>
          )}
          {(settings.homeShape ?? 1.0) >= 1.2 && (settings.homeShape ?? 1.0) < 1.3 && (settings.hasLoft ?? false) && (
            <p className="text-xs text-[#A7B0BA] mt-1.5">
              Loft reduces heat loss per square foot (~35% of sqft has ~50% less exterior exposure). This lowers your heat loss estimate.
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Average Ceiling Height
          </label>
          <select
            value={settings.ceilingHeight ?? 8}
            onChange={(e) => onSettingChange("ceilingHeight", Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          >
            <option value={8}>8 feet (standard)</option>
            <option value={9}>9 feet</option>
            <option value={10}>10 feet</option>
            <option value={12}>12 feet (vaulted)</option>
            <option value={16}>16 feet</option>
          </select>
          <p className="text-xs text-[#A7B0BA] mt-1.5">
            Higher ceilings increase the volume to heat and energy needs (+10% per foot above 8').
          </p>
        </div>
      </div>
      
      {/* Vertical Wall Height - Only for Cabin */}
      {(settings.homeShape ?? 1.0) >= 1.2 && (settings.homeShape ?? 1.0) < 1.3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
              Vertical Wall Height
            </label>
            <select
              value={settings.wallHeight ?? 0}
              onChange={(e) => onSettingChange("wallHeight", Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={settings.useManualHeatLoss}
            >
              <option value={0}>0 feet</option>
              <option value={4}>4 feet</option>
              <option value={6}>6 feet</option>
              <option value={8}>8 feet</option>
              <option value={10}>10 feet</option>
              <option value={12}>12 feet</option>
            </select>
            <p className="text-xs text-[#A7B0BA] mt-1.5">
              Vertical wall height before the roof slopes. Affects wall surface area and heat loss through the geometric shape calculation.
            </p>
          </div>
        </div>
      )}

      {/* Solar Exposure */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Solar Exposure (Cooling Load)
          </label>
          <select
            value={(() => {
              const val = settings.solarExposure ?? 1.5;
              if (val >= 1.7) return "high";
              if (val >= 1.4) return "medium";
              if (val >= 1.2) return "low";
              return "shaded";
            })()}
            onChange={(e) => {
              const mapping = { 
                shaded: 1.1,  // Shaded/minimal windows (allows lower values)
                low: 1.3,     // Low exposure
                medium: 1.5,  // Medium exposure (typical)
                high: 1.8     // High exposure
              };
              let value = mapping[e.target.value];
              // Clamp to [1.0, 2.5] range (shaded allows 1.0-1.2, others 1.3-1.8)
              value = Math.max(1.0, Math.min(2.5, value));
              onSettingChange("solarExposure", value);
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          >
            <option value="shaded">Shaded/Minimal Windows (1.1×)</option>
            <option value="low">Low (1.3×)</option>
            <option value="medium">Medium (1.5×) - Typical</option>
            <option value="high">High (1.8×)</option>
          </select>
          <p className="text-xs text-[#A7B0BA] mt-1.5">
            Solar exposure affects cooling load in summer. High exposure (south-facing windows, minimal shade) increases cooling needs. 
            Current multiplier: <strong>{(settings.solarExposure ?? 1.0).toFixed(1)}×</strong>
          </p>
        </div>
      </div>
      
      {/* Heat Loss Source Selection */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
          Heat Loss Source
        </label>
        <p className="text-xs text-[#A7B0BA] mb-4 max-w-2xl leading-relaxed">
          Choose how Joule should <strong>estimate</strong> your home's heat loss. Only one option can be active at a time.
        </p>
        
        <div className="space-y-3">
          {/* Calculated (DoE) Option - Recommended */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="radio"
                name="heatLossSource"
                className="h-4 w-4"
                checked={!!settings.useCalculatedHeatLoss || (!settings.useManualHeatLoss && !settings.useAnalyzerHeatLoss && !settings.useLearnedHeatLoss)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSettingChange("useManualHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useLearnedHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", true);
                    // Mark that user has made an explicit choice - never auto-select again
                    localStorage.setItem('heatLossMethodUserChoice', 'true');
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                ○ Calculated (DOE Data) — Recommended
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                A conservative estimate based on home size, insulation, and layout. Works well for most homes.
              </p>
              {(settings.useCalculatedHeatLoss || (!settings.useManualHeatLoss && !settings.useAnalyzerHeatLoss)) && (
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

          {/* Manual Entry Option */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="radio"
                name="heatLossSource"
                className="h-4 w-4"
                checked={!!settings.useManualHeatLoss}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSettingChange("useCalculatedHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useLearnedHeatLoss", false);
                    onSettingChange("useManualHeatLoss", true);
                    // Mark that user has made an explicit choice - never auto-select again
                    localStorage.setItem('heatLossMethodUserChoice', 'true');
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                ○ Manual Entry (Advanced)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                For homeowners with a professional energy audit.
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-[#7C8894] whitespace-nowrap">
                      BTU/hr/°F
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analyzer CSV Option */}
          {(() => {
            // Check if analyzer has measured data (not fallback/estimated)
            const analyzerSource = settings.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
            const isMeasured = analyzerSource === 'measured';
            const hasAnalyzerData = outletContext?.heatLossFactor || settings.analyzerHeatLoss;
            const isDisabled = !hasAnalyzerData || !isMeasured;
            
            return (
              <div className={`flex items-start gap-3 ${isDisabled ? 'opacity-50' : ''}`}>
                <label className="inline-flex items-center gap-2 mt-1">
                  <input
                    type="radio"
                    name="heatLossSource"
                    className="h-4 w-4"
                    checked={!!settings.useAnalyzerHeatLoss && !isDisabled}
                    disabled={isDisabled}
                    onChange={(e) => {
                      if (e.target.checked && !isDisabled) {
                        onSettingChange("useManualHeatLoss", false);
                        onSettingChange("useCalculatedHeatLoss", false);
                        onSettingChange("useLearnedHeatLoss", false);
                        onSettingChange("useAnalyzerHeatLoss", true);
                        // Mark that user has made an explicit choice - never auto-select again
                        localStorage.setItem('heatLossMethodUserChoice', 'true');
                      }
                    }}
                  />
                </label>
                <div className="flex-1">
                  <label className={`block text-xs font-semibold ${isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                    ○ From Thermostat Data (Optional)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Uses uploaded thermostat history to measure heat loss directly when available.
                  </p>
                  
                  {isDisabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      {!hasAnalyzerData ? (
                        <span>
                          No analyzer data available.{" "}
                          <Link 
                            to="/performance-analyzer" 
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Upload CSV in System Performance Analyzer →
                          </Link>
                        </span>
                      ) : (
                        <span>
                          Not available yet — your data didn't include a long enough "system off" window.
                          Joule will continue using a conservative estimate instead.
                        </span>
                      )}
                    </p>
                  )}
                  
                  {!isDisabled && settings.useAnalyzerHeatLoss && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      Current value: {Number(outletContext?.heatLossFactor || settings.analyzerHeatLoss).toFixed(1)} BTU/hr/°F
                      <span className="ml-2 text-emerald-500 dark:text-emerald-300">(Measured from coast-down)</span>
                    </p>
                  )}
                  
                  {!isDisabled && !settings.useAnalyzerHeatLoss && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                      Measured CSV data available ({Number(outletContext?.heatLossFactor || settings.analyzerHeatLoss).toFixed(1)} BTU/hr/°F). Click to use it.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* From Bill Data (Auto-learned) Option */}
          {(() => {
            const hasLearnedData = settings.learnedHeatLoss && typeof settings.learnedHeatLoss === "number" && settings.learnedHeatLoss > 0;
            const learnedDays = settings.learnedHeatLossDays || 0;
            const learnedMonths = (settings.learnedHeatLossMonths || []).length;
            const totalBillDays = getTotalBillDaysEntered();
            const canUseLearned = totalBillDays >= MIN_BILL_DAYS_FOR_LEARNED;
            return (
              <div className={`flex items-start gap-3 ${!hasLearnedData ? "opacity-50" : ""}`}>
                <label className="inline-flex items-center gap-2 mt-1">
                  <input
                    type="radio"
                    name="heatLossSource"
                    className="h-4 w-4"
                    checked={!!settings.useLearnedHeatLoss && hasLearnedData}
                    disabled={!hasLearnedData}
                    onChange={(e) => {
                      if (e.target.checked && hasLearnedData) {
                        onSettingChange("useManualHeatLoss", false);
                        onSettingChange("useCalculatedHeatLoss", false);
                        onSettingChange("useAnalyzerHeatLoss", false);
                        onSettingChange("useLearnedHeatLoss", true);
                        localStorage.setItem("heatLossMethodUserChoice", "true");
                      }
                    }}
                  />
                </label>
                <div className="flex-1">
                  <label className={`block text-xs font-semibold ${!hasLearnedData ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"}`}>
                    ○ From Bill Data (Auto-learned)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Back-calculated from pasted utility bill data vs. weather. Joule uses DOE estimates until you've entered at least {MIN_BILL_DAYS_FOR_LEARNED} days of actual bill data.
                  </p>
                  {!hasLearnedData && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      Paste your bill in Monthly Forecast → Compare with your forecast to enable.
                    </p>
                  )}
                  {hasLearnedData && settings.useLearnedHeatLoss && (
                    <>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        Current value: {Number(settings.learnedHeatLoss).toFixed(0)} BTU/hr/°F
                        <span className="ml-2 text-emerald-500 dark:text-emerald-300">
                          (from {learnedDays} days across {learnedMonths} month{learnedMonths !== 1 ? "s" : ""})
                        </span>
                      </p>
                      {!canUseLearned && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          Joule is using DOE until 30+ days entered (you have {totalBillDays} days).
                        </p>
                      )}
                    </>
                  )}
                  {hasLearnedData && !settings.useLearnedHeatLoss && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                      Bill data available ({Number(settings.learnedHeatLoss).toFixed(0)} BTU/hr/°F). Click to use it once you have 30+ days.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Section>
  );
};

const CostSettings = ({ settings, onSettingChange, userSettings, setToast }) => {
  // Get location from userSettings or localStorage userLocation
  const [userLocation, _setUserLocation] = useState(() => {
    try {
      const stored = localStorage.getItem("userLocation");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  
  const location = userSettings?.location || userSettings?.city || userLocation?.city;
  // Get state - could be abbreviation (GA) or full name (Georgia)
  // Check both userSettings and userLocation
  const rawState = userSettings?.state || userSettings?.stateName || userLocation?.state;
  const state = rawState && rawState !== "US" ? rawState : null;
  
  // Calculate average rate for display
  const avgRate = useMemo(() => {
    if (!state) return 0.15;
    // Try to get rate for the state (handles both abbreviations and full names)
    try {
      return getStateElectricityRate(state);
    } catch {
      return 0.15;
    }
  }, [state]);
  
  // Loading states for rate fetching buttons
  const [loadingElectricity, setLoadingElectricity] = useState(false);
  const [loadingGas, setLoadingGas] = useState(false);
  
  // Get default fixed charge from state lookup
  const defaultFixedCharge = useMemo(() => {
    if (!state) return defaultFallbackFixedCharges.electric;
    const stateAbbr = normalizeStateToAbbreviation(state);
    return stateAbbr && defaultFixedChargesByState[stateAbbr]
      ? defaultFixedChargesByState[stateAbbr].electric
      : defaultFallbackFixedCharges.electric;
  }, [state]);
  
  // Handler to fetch and set electricity rate from state average
  const handleSetElectricityRate = async () => {
    if (!state) {
      setToast?.({ message: "Please set your location first", type: "error" });
      return;
    }
    
    setLoadingElectricity(true);
    try {
      // Try to fetch live rate first
      const stateCode = getStateCode(state);
      let rate = null;
      let source = "";
      
      if (stateCode) {
        try {
          const liveData = await fetchLiveElectricityRate(stateCode);
          if (liveData?.rate) {
            rate = liveData.rate;
            source = "Live EIA Data";
          }
        } catch (e) {
          console.warn("Failed to fetch live rate, using fallback", e);
        }
      }
      
      // Fallback to hardcoded state average
      if (!rate) {
        rate = getStateElectricityRate(state);
        source = `${state} Average`;
      }
      
      onSettingChange("utilityCost", rate);
      setToast?.({ 
        message: `Electricity rate set to $${rate.toFixed(3)}/kWh (${source})`, 
        type: "success" 
      });
    } catch (error) {
      console.error("Failed to fetch electricity rate:", error);
      setToast?.({ message: "Failed to fetch electricity rate", type: "error" });
    } finally {
      setLoadingElectricity(false);
    }
  };
  
  // Handler to fetch and set gas rate from state average
  const handleSetGasRate = async () => {
    if (!state) {
      setToast?.({ message: "Please set your location first", type: "error" });
      return;
    }
    
    setLoadingGas(true);
    try {
      // Try to fetch live rate first
      const stateCode = getStateCode(state);
      let rate = null;
      let source = "";
      
      if (stateCode) {
        try {
          const liveData = await fetchLiveGasRate(stateCode);
          if (liveData?.rate) {
            rate = liveData.rate;
            source = "Live EIA Data";
          }
        } catch (e) {
          console.warn("Failed to fetch live gas rate, using fallback", e);
        }
      }
      
      // Fallback to hardcoded state average
      if (!rate) {
        rate = getStateGasRate(state);
        source = `${state} Average`;
      }
      
      onSettingChange("gasCost", rate);
      setToast?.({ 
        message: `Gas rate set to $${rate.toFixed(2)}/therm (${source})`, 
        type: "success" 
      });
    } catch (error) {
      console.error("Failed to fetch gas rate:", error);
      setToast?.({ message: "Failed to fetch gas rate", type: "error" });
    } finally {
      setLoadingGas(false);
    }
  };
  
  return (
    <Section 
      title="Cost Settings" 
      icon={<DollarSign size={20} />}
      description="Used for 7-day cost forecasts, annual estimates, and gas vs heat pump comparisons."
    >
      <p className="text-xs text-[#A7B0BA] mb-4 italic">
        These rates are used for budgeting and comparisons. They do not affect your utility bill or thermostat.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Cost per kWh ($)
          </label>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#A7B0BA]">$</span>
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
              className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.15"
            />
            <span className="text-xs text-[#7C8894]">/kWh</span>
          </div>
          {state && (
            <button
              type="button"
              onClick={handleSetElectricityRate}
              disabled={loadingElectricity}
              className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-[#E8EDF3] hover:bg-slate-800 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={`Set to ${state} state average`}
            >
              {loadingElectricity ? "Loading..." : "Use State Average"}
            </button>
          )}
          {location && (
            <p className="text-xs text-blue-400 mt-1.5 max-w-md">
              💡 {location}, {state} average: ${avgRate.toFixed(2)}/kWh (EIA data)
            </p>
          )}
          {!location && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Used for budget calculations and cost estimates
            </p>
          )}
        </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
          Gas Cost per Therm ($)
        </label>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#A7B0BA]">$</span>
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
            className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="1.20"
          />
          <span className="text-xs text-[#7C8894]">/therm</span>
        </div>
        {state && (
          <button
            type="button"
            onClick={handleSetGasRate}
            disabled={loadingGas}
            className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 text-[#E8EDF3] hover:bg-slate-800 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={`Set to ${state} state average`}
          >
            {loadingGas ? "Loading..." : "Use State Average"}
          </button>
        )}
          {location && (
            <p className="text-xs text-blue-400 mt-1.5 max-w-md">
              💡 {location}, {state} average: ~$1.20/therm (EIA data)
            </p>
          )}
          {!location && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Used for gas furnace cost comparisons
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Fixed Monthly Charge ($)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[#A7B0BA]">$</span>
            <input
              type="number"
              min={0}
              max={50}
              step={0.01}
              value={settings.fixedElectricCost != null ? settings.fixedElectricCost : defaultFixedCharge}
              onChange={(e) => {
                const inputVal = e.target.value;
                // Allow empty input while typing
                if (inputVal === '' || inputVal === '.') {
                  onSettingChange("fixedElectricCost", null);
                  return;
                }
                const val = Number(inputVal);
                if (!isNaN(val)) {
                  // Don't round during typing - just clamp the value
                  const clamped = Math.min(50, Math.max(0, val));
                  onSettingChange("fixedElectricCost", clamped);
                }
              }}
              onBlur={(e) => {
                // Format to 2 decimals on blur
                const val = Number(e.target.value);
                if (!isNaN(val) && val >= 0) {
                  const clamped = Math.min(50, Math.max(0, val));
                  const rounded = Math.round(clamped * 100) / 100;
                  onSettingChange("fixedElectricCost", rounded);
                } else if (settings.fixedElectricCost == null) {
                  onSettingChange("fixedElectricCost", defaultFixedCharge);
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={defaultFixedCharge.toFixed(2)}
            />
            <span className="text-xs text-[#7C8894]">/mo</span>
          </div>
          {location && (
            <p className="text-xs text-blue-400 mt-1.5 max-w-md">
              💡 {location}, {state} default: ${defaultFixedCharge.toFixed(2)}/mo (typical service charge)
            </p>
          )}
          {!location && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Monthly service charge (meter fees, connection fees)
            </p>
          )}
        </div>
      </div>
    </Section>
  );
};

const AdvancedEquipmentProfile = ({ settings, onSettingChange, setToast: _SET_TOAST }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded) {
      // Enable custom profile when expanding
      onSettingChange("useCustomEquipmentProfile", true);
    }
    setExpanded(!expanded);
  };

  const handleInputChange = (key, value) => {
    const numValue = value === "" ? null : Number(value);
    onSettingChange(key, numValue);
  };

  const hasRequiredData = 
    settings.capacity47 && 
    settings.capacity17 && 
    settings.cop47 && 
    settings.cop17;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Advanced: Custom COP Curve (Optional)
            </p>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="COP (Coefficient of Performance) measures heat pump efficiency. A COP curve shows how efficiency changes at different outdoor temperatures. Higher COP = more efficient."
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upload NEEP data or manually enter capacity/COP at different temperatures for more accurate balance point calculations.
          </p>
        </div>
        <button
          onClick={handleToggle}
          className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={!!settings.useCustomEquipmentProfile}
                onChange={(e) => onSettingChange("useCustomEquipmentProfile", e.target.checked)}
                className="h-4 w-4"
              />
              Enable Custom Equipment Profile
            </label>
            {hasRequiredData && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 size={14} />
                Profile Complete
              </span>
            )}
          </div>

          {settings.useCustomEquipmentProfile && (
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
                Required: Capacity and COP at 47°F and 17°F
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capacity at 47°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    Capacity @ 47°F (BTU/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200000}
                    step={100}
                    value={settings.capacity47 ?? ""}
                    onChange={(e) => handleInputChange("capacity47", e.target.value)}
                    placeholder="e.g., 36000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Rated capacity (from NEEP or spec sheet)
                  </p>
                </div>

                {/* Capacity at 17°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    Capacity @ 17°F (BTU/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200000}
                    step={100}
                    value={settings.capacity17 ?? ""}
                    onChange={(e) => handleInputChange("capacity17", e.target.value)}
                    placeholder="e.g., 28000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Cold climate capacity
                  </p>
                </div>

                {/* COP at 47°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    COP @ 47°F
                  </label>
                  <input
                    type="number"
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    value={settings.cop47 ?? ""}
                    onChange={(e) => handleInputChange("cop47", e.target.value)}
                    placeholder="e.g., 4.2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Coefficient of Performance at rated temp
                  </p>
                </div>

                {/* COP at 17°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    COP @ 17°F
                  </label>
                  <input
                    type="number"
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    value={settings.cop17 ?? ""}
                    onChange={(e) => handleInputChange("cop17", e.target.value)}
                    placeholder="e.g., 2.8"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    COP at cold temperature
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mb-1">
                  💡 How to find this data:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                  <li>NEEP Cold-Climate Heat Pump Database: neep.org</li>
                  <li>Manufacturer submittal sheets or product data catalogs</li>
                  <li>AHRI Directory for matched system performance</li>
                </ul>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  <strong>Result:</strong> Your balance point and cost calculations become dead accurate instead of using generic "average" efficiency curves.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HvacSystemConfig = ({ settings, onSettingChange, setToast }) => {
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const capacities = { 18: 1.5, 24: 2, 30: 2.5, 36: 3, 42: 3.5, 48: 4, 60: 5 };

  return (
    <Section
      title="HVAC System Configuration"
      icon={<ThermometerSun size={20} />}
    >
      <div className="space-y-4">
        {/* Primary System Selection */}
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Primary Heating System
          </label>
          <p className="text-xs text-[#A7B0BA] mb-3 max-w-2xl">
            Select how your home is heated.
          </p>
          <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => onSettingChange("primarySystem", "heatPump")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                settings.primarySystem === "heatPump"
                  ? "bg-[#1E4CFF] text-white"
                  : "bg-slate-900 text-[#A7B0BA] hover:text-white hover:bg-slate-800"
              }`}
            >
              ⚡ Heat Pump
            </button>
            <button
              onClick={() => onSettingChange("primarySystem", "gasFurnace")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                settings.primarySystem === "gasFurnace"
                  ? "bg-[#1E4CFF] text-white"
                  : "bg-slate-900 text-[#A7B0BA] hover:text-white hover:bg-slate-800"
              }`}
            >
              <Flame size={16} /> Gas Furnace
            </button>
            <button
              onClick={() => onSettingChange("primarySystem", "acPlusGas")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                settings.primarySystem === "acPlusGas"
                  ? "bg-[#1E4CFF] text-white"
                  : "bg-slate-900 text-[#A7B0BA] hover:text-white hover:bg-slate-800"
              }`}
            >
              <Flame size={16} /> Central AC + Gas
            </button>
          </div>
        </div>

        {/* Heat Pump Configuration */}
        {settings.primarySystem === "heatPump" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Heating Efficiency (HSPF2)
                </label>
                <button
                  type="button"
                  className="text-[#7C8894] hover:text-[#A7B0BA]"
                  title="HSPF2 (Heating Seasonal Performance Factor) measures heat pump heating efficiency. Higher = more efficient. Typical range: 8-10.5 for modern systems."
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Cooling Efficiency (SEER2)
                </label>
                <button
                  type="button"
                  className="text-[#7C8894] hover:text-[#A7B0BA]"
                  title="SEER2 (Seasonal Energy Efficiency Ratio) measures A/C cooling efficiency. Higher = more efficient. Typical range: 14-18 for modern systems."
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
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
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Furnace AFUE
                </label>
                <button
                  type="button"
                  onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                  className="text-[#7C8894] hover:text-[#A7B0BA] transition-colors"
                  aria-label="What's AFUE?"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
              {showAfueTooltip && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">What&apos;s AFUE?</p>
                  <p className="mb-2">AFUE (Annual Fuel Utilization Efficiency) is like your furnace&apos;s &quot;gas mileage.&quot; 90-98%: high-efficiency; 80%: standard; &lt;80%: older.</p>
                </div>
              )}
              <input
                type="number"
                min={60}
                max={99}
                step={1}
                value={Math.round((settings.afue ?? 0.9) * 100)}
                onChange={(e) =>
                  onSettingChange(
                    "afue",
                    Math.min(0.99, Math.max(0.6, Number(e.target.value) / 100))
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                Furnace Size (kBTU)
              </label>
              <select
                value={settings.capacity ?? 80}
                onChange={(e) => onSettingChange("capacity", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[40, 60, 80, 100, 120].map((k) => (
                  <option key={k} value={k}>{k}k BTU</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Central AC + Gas Configuration (cooling in summer, gas in winter) */}
        {settings.primarySystem === "acPlusGas" && (
          <div className="space-y-4">
            <p className="text-xs text-[#A7B0BA]">Cooling (AC) in summer, gas heat in winter.</p>
            <div>
              <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                AC / Condenser Size (summer cooling, kBTU)
              </label>
              <select
                value={settings.coolingCapacity ?? 36}
                onChange={(e) => onSettingChange("coolingCapacity", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[18, 24, 30, 36, 42, 48, 60].map((k) => (
                  <option key={k} value={k}>{k}k BTU ({k / 12} tons)</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Furnace AFUE (winter heat)
                </label>
                <button
                  type="button"
                  onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                  className="text-[#7C8894] hover:text-[#A7B0BA] transition-colors"
                  aria-label="What's AFUE?"
                >
                  <HelpCircle size={14} />
                </button>
              </div>
              <input
                type="number"
                min={60}
                max={99}
                step={1}
                value={Math.round((settings.afue ?? 0.9) * 100)}
                onChange={(e) =>
                  onSettingChange(
                    "afue",
                    Math.min(0.99, Math.max(0.6, Number(e.target.value) / 100))
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                Furnace Size (winter heat, kBTU)
              </label>
              <select
                value={settings.capacity ?? 80}
                onChange={(e) => onSettingChange("capacity", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[40, 60, 80, 100, 120].map((k) => (
                  <option key={k} value={k}>{k}k BTU</option>
                ))}
              </select>
            </div>
          </div>
        )}


      </div>
    </Section>
  );
};

const SettingsPage = () => {
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

  const location = useLocation();
  const _params = useParams();
  
  // Check if we're on a specific section route (e.g., /settings/home-setup)
  const sectionFromRoute = location.pathname.split('/settings/')[1];
  const isIndexPage = !sectionFromRoute || location.pathname === '/settings';

  const [activeSection, setActiveSection] = useState(sectionFromRoute || "home-setup");
  const [showPlans, setShowPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    "home-setup": sectionFromRoute === "home-setup" || isIndexPage,
    "system-config": sectionFromRoute === "system-config",
    "costs-rates": sectionFromRoute === "costs-rates",
    "thermostat": sectionFromRoute === "thermostat",
    "bridge-ai": sectionFromRoute === "bridge-ai",
  });
  const sections = [
    { id: "home-setup", label: "Home Setup", number: "1", icon: Home, description: "Tell Joule about your home so estimates match reality", color: "blue" },
    { id: "system-config", label: "System Configuration", number: "2", icon: Zap, description: "Describe your HVAC system so Joule can model it accurately", color: "purple" },
    { id: "costs-rates", label: "Costs & Rates", number: "3", icon: DollarSign, description: "Set utility rates and pricing preferences", color: "green" },
    { id: "thermostat", label: "Thermostat Preferences", number: "4", icon: ThermometerSun, description: "Describe your typical thermostat preferences (for estimates only)", color: "orange" },
    { id: "bridge-ai", label: "Bridge & AI", number: "5", icon: Server, description: "Connect hardware and configure AI features", color: "cyan" },
  ];

  const sectionColorClasses = {
    blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
    purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
    green: { bg: "bg-green-500/20", text: "text-green-400" },
    orange: { bg: "bg-orange-500/20", text: "text-orange-400" },
    cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  };

  // Handle hash navigation (e.g., /settings#comfort-settings)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#comfort-settings") {
      // Expand thermostat section if collapsed
      setExpandedSections(prev => ({ ...prev, "thermostat": true }));
      // Scroll to comfort settings after a short delay to allow render
      setTimeout(() => {
        const element = document.getElementById("comfort-settings");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          // Also expand the comfort section in ThermostatSettingsPanel
          // This will be handled by the component's internal state
        }
      }, 100);
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      const sectionIds = ["home-setup", "system-config", "costs-rates", "thermostat", "bridge-ai"];
      for (const sectionId of sectionIds) {
        const element = document.getElementById(sectionId);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ensure section is expanded when on its route
  useEffect(() => {
    if (sectionFromRoute) {
      setExpandedSections(prev => ({ ...prev, [sectionFromRoute]: true }));
    }
  }, [sectionFromRoute]);

  // If on index page, show the index view (after all hooks)
  if (isIndexPage) {
    const SettingsIndex = React.lazy(() => import('./SettingsIndex'));
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#050B10] flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
        <SettingsIndex />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="w-full px-6 lg:px-8 py-6">
        <Breadcrumbs />
        
        {/* Page Header */}
        <header className="mb-8">
          {sectionFromRoute ? (
            <div>
              <Link 
                to="/settings" 
                className="inline-flex items-center gap-2 text-sm text-[#A7B0BA] hover:text-white mb-4 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Settings
              </Link>
              {(() => {
                const section = sections.find(s => s.id === sectionFromRoute);
                if (!section) return null;
                const Icon = section.icon;
                const colorClass = sectionColorClasses[section.color] || sectionColorClasses.blue;
                return (
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${colorClass.bg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${colorClass.text}`} />
                    </div>
                    <div>
                      <h1 className="text-[32px] font-bold text-[#FFFFFF] mb-1">
                        {section.number}. {section.label}
                      </h1>
                      <p className="text-sm text-[#A7B0BA]">
                        {section.description}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-[32px] font-bold text-[#FFFFFF] mb-2">
                  Settings
                </h1>
            <p className="text-sm text-[#A7B0BA] mb-1">
              Set up how Joule <strong>models</strong> your home, system, and energy costs.
            </p>
            <p className="text-xs text-[#7C8894] italic">
              These settings are used for estimates and analysis. Joule does not change your thermostat schedule or comfort settings.
            </p>
            <p className="text-xs text-[#7C8894] mt-2">
              <strong>Joule estimates and explains — it doesn't override your comfort or control your home.</strong>
            </p>
              </div>
              <DashboardLink />
            </div>
          )}
        </header>

        {/* Top Navigation Bar - Hide on specific section pages */}
        {!sectionFromRoute && (
        <div className="mb-6 sticky top-0 z-50 bg-[#050B10]/95 backdrop-blur-sm pb-4 pt-2 -mx-6 lg:-mx-8 px-6 lg:px-8 border-b border-slate-800">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Horizontal Navigation */}
            <nav className="flex flex-wrap gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const isExpanded = expandedSections[section.id];
                return (
                  <Link
                    key={section.id}
                    to={`/settings/${section.id}`}
                    onClick={(e) => {
                      // If already on that section, toggle expand/collapse
                      if (sectionFromRoute === section.id) {
                        e.preventDefault();
                        setExpandedSections(prev => ({ ...prev, [section.id]: !prev[section.id] }));
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-[#1E4CFF] text-white shadow-lg shadow-blue-500/20"
                        : "bg-[#0C1118] text-[#A7B0BA] hover:text-white hover:bg-slate-900 border border-slate-800"
                    }`}
                    title={section.description}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span className="text-xs font-bold">{section.number}</span>
                    <span>{section.label}</span>
                    {(isExpanded ? (
                      <ChevronUp className="w-3 h-3 ml-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 ml-1" />
                    ))}
                  </Link>
                );
              })}
            </nav>
            
            {/* Search Bar - Compact */}
            <div className="relative w-full lg:w-64 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7B0BA]" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-[#0C1118] border border-slate-800 rounded-lg text-sm text-[#E8EDF3] placeholder-[#A7B0BA] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A7B0BA] hover:text-white"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Sticky Side Navigation - Right Side (Desktop Only) - Hide on section pages */}
        {!sectionFromRoute && (
        <div className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 z-40">
          <nav className="bg-[#0C1118] border border-slate-800 rounded-xl p-3 shadow-xl">
            <div className="space-y-1">
              <div className="px-2 pb-2 mb-2 border-b border-slate-800">
                <h3 className="text-xs font-semibold text-[#A7B0BA] uppercase tracking-wider">Quick Nav</h3>
              </div>
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const element = document.getElementById(section.id);
                      if (element) {
                        // Calculate offset for sticky nav bar
                        const stickyNav = document.querySelector('[class*="sticky top-0"]');
                        const stickyNavHeight = stickyNav ? stickyNav.getBoundingClientRect().height + 20 : 120;
                        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                        const offsetPosition = elementPosition - stickyNavHeight;
                        
                        window.scrollTo({
                          top: Math.max(0, offsetPosition),
                          behavior: "smooth"
                        });
                        
                        // Expand the section after a short delay to ensure smooth scroll
                        setTimeout(() => {
                          setExpandedSections(prev => ({ ...prev, [section.id]: true }));
                        }, 100);
                      }
                    }}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                      activeSection === section.id
                        ? "bg-[#1E4CFF] text-white shadow-lg shadow-blue-500/20"
                        : "text-[#A7B0BA] hover:text-white hover:bg-slate-900"
                    }`}
                    title={section.description}
                  >
                    <Icon className={`w-3.5 h-3.5 ${activeSection === section.id ? "text-white" : "text-slate-400"}`} />
                    <span className="font-medium">{section.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        </div>
        )}

      {/* Product Tiers - Collapsible - Hide on specific section pages */}
      {!sectionFromRoute && (
      <div className="mb-8 bg-[#0C1118] border border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPlans((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-[#E8EDF3]">
              Comfort strategy & hardware tiers
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-[#A7B0BA] transition-transform ${showPlans ? "rotate-180" : ""}`} />
        </button>
        {showPlans && (
          <div className="p-6 border-t border-slate-800">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-1">Choose Your Comfort Strategy</h3>
              <p className="text-xs text-[#A7B0BA]">Select a product tier to unlock features</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free Tier */}
          <div className="bg-[#0C1118] border-2 border-slate-700 rounded-lg p-4 flex flex-col relative">
            <div className="absolute top-3 right-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">Current</span>
            </div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Free</h4>
              <span className="text-2xl font-extrabold text-white leading-tight">$0</span>
            </div>
            <p className="text-sm text-slate-300 mb-3 font-semibold">Analyzer</p>
            <p className="text-xs text-slate-400 mb-3">Manual CSV upload • Lead magnet</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Manual CSV upload & analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Heat loss calculation (BTU/hr/°F)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">System balance point analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Efficiency percentile ranking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Export results to CSV</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-500">No automatic monitoring</span>
              </li>
            </ul>
          </div>

          {/* Bridge Tier - Controller */}
          <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-lg border-2 border-amber-500/50 p-4 relative flex flex-col">
            <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">POPULAR</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Bridge</h4>
              <span className="text-2xl font-extrabold text-amber-400 leading-tight whitespace-nowrap">$129</span>
            </div>
            <p className="text-sm text-amber-200 mb-1 font-semibold">Controller</p>
            <p className="text-xs text-amber-300/80 mb-3">One-time purchase • Pi Zero 2 W • The standard brain</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Everything in Free tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Pi Zero 2 W hardware included</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Local control & short cycle protection</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Automatic data logging</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Full thermostat control (setpoints, schedules)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Works completely offline</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Cloud AI ready (bring your own API key)</span>
              </li>
            </ul>
            <a
              href={EBAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl text-center"
            >
              Buy Now - $129
            </a>
          </div>

          {/* Sovereign Tier - AI Core */}
          <div className="bg-gradient-to-br from-violet-600/20 to-purple-600/20 rounded-lg border-2 border-violet-500/50 p-4 relative flex flex-col opacity-90">
            <div className="absolute top-3 right-3 bg-violet-500 text-white text-xs font-bold px-2 py-1 rounded">COMING SOON</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Sovereign</h4>
              <span className="text-2xl font-extrabold text-violet-400 leading-tight whitespace-nowrap">$299</span>
            </div>
            <p className="text-sm text-violet-200 mb-1 font-semibold">The AI Core</p>
            <p className="text-xs text-violet-300/80 mb-3">Coming Soon • Pi 5 16GB • The genius brain</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Everything in Bridge tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Pi 5 16GB hardware included</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Voice control (Local Whisper)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">LLM intelligence (on-device)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">100% air-gapped operation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Maximum privacy & sovereignty</span>
              </li>
            </ul>
            <button
              disabled
              className="mt-auto w-full px-6 py-3 bg-slate-700 text-slate-400 rounded-lg font-bold text-lg cursor-not-allowed text-center"
            >
              Coming Soon
            </button>
          </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Section 1: Home Setup */}
      {(!sectionFromRoute || sectionFromRoute === "home-setup") && (
      <div id="home-setup" className="mb-12 scroll-mt-24">
        {!sectionFromRoute && (
        <div className="mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Home className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#E8EDF3] mb-1">1. Home Setup</h2>
                <p className="text-sm text-[#A7B0BA]">Tell Joule about your home so estimates match reality.</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, "home-setup": !prev["home-setup"] }))}
              className="text-[#A7B0BA] hover:text-white transition-colors"
            >
              {expandedSections["home-setup"] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>
        </div>
        )}
        {(expandedSections["home-setup"] || sectionFromRoute === "home-setup") && (
          <div className="space-y-6">
            <BuildingCharacteristics
              settings={userSettings}
              onSettingChange={setUserSetting}
              outletContext={outletCtx}
            />
          </div>
        )}
      </div>
      )}

      {/* Section 2: System Configuration */}
      {(!sectionFromRoute || sectionFromRoute === "system-config") && (
      <div id="system-config" className="mb-12 scroll-mt-24">
        {!sectionFromRoute && (
        <div className="mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#E8EDF3] mb-1">2. System Configuration</h2>
                <p className="text-sm text-[#A7B0BA]">Describe your HVAC system so Joule can model it accurately.</p>
                <p className="text-xs text-[#7C8894] mt-1 italic">This section does not control your equipment — it only affects calculations.</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, "system-config": !prev["system-config"] }))}
              className="text-[#A7B0BA] hover:text-white transition-colors"
            >
              {expandedSections["system-config"] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>
        </div>
        )}
        {(expandedSections["system-config"] || sectionFromRoute === "system-config") && (
          <div className="space-y-6">
            <HvacSystemConfig
              settings={userSettings}
              onSettingChange={setUserSetting}
              setToast={setToast}
            />

            {/* Advanced Equipment Profile (Elite Tier) */}
            {userSettings.primarySystem === "heatPump" && (
              <Section title="Advanced Equipment Profile" icon={<Crown className="w-5 h-5 text-amber-500" />}>
                <AdvancedEquipmentProfile
                  settings={userSettings}
                  onSettingChange={setUserSetting}
                  setToast={setToast}
                />
              </Section>
            )}
          </div>
        )}
      </div>
      )}

      {/* Section 3: Costs & Rates */}
      {(!sectionFromRoute || sectionFromRoute === "costs-rates") && (
      <div id="costs-rates" className="mb-12 scroll-mt-24">
        {!sectionFromRoute && (
        <div className="mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#E8EDF3] mb-1">3. Costs & Rates</h2>
                <p className="text-sm text-[#A7B0BA]">Set utility rates and pricing preferences</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, "costs-rates": !prev["costs-rates"] }))}
              className="text-[#A7B0BA] hover:text-white transition-colors"
            >
              {expandedSections["costs-rates"] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>
        </div>
        )}
        {(expandedSections["costs-rates"] || sectionFromRoute === "costs-rates") && (
          <CostSettings
            settings={userSettings}
            onSettingChange={setUserSetting}
            userSettings={userSettings}
            setToast={setToast}
          />
        )}
      </div>
      )}

      {/* Section 4: Thermostat Behavior */}
      {(!sectionFromRoute || sectionFromRoute === "thermostat") && (
      <div id="thermostat" className="mb-12 scroll-mt-24">
        {!sectionFromRoute && (
        <div className="mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <ThermometerSun className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#E8EDF3] mb-1">4. Thermostat Preferences</h2>
                <p className="text-sm text-[#A7B0BA]">Describe your typical thermostat preferences (for estimates only)</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, "thermostat": !prev["thermostat"] }))}
              className="text-[#A7B0BA] hover:text-white transition-colors"
            >
              {expandedSections["thermostat"] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>
        </div>
        )}
        {(expandedSections["thermostat"] || sectionFromRoute === "thermostat") && (
        <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
          {/* Important Disclaimer */}
          <div className="mb-6 p-4 bg-amber-950/30 border border-amber-800/50 rounded-lg">
            <p className="text-sm font-semibold text-amber-400 mb-2">Important:</p>
            <p className="text-xs text-[#A7B0BA] mb-2">When using HomeKit, Joule can only:</p>
            <ul className="text-xs text-[#A7B0BA] list-disc list-inside ml-2 space-y-1 mb-2">
              <li>Read the current temperature</li>
              <li>Read/set the target temperature</li>
              <li>Change mode (Heat / Cool / Auto / Off)</li>
            </ul>
            <p className="text-xs text-[#A7B0BA]">
              Joule <strong>cannot</strong> read or change schedules, comfort profiles, or occupancy settings.
              The settings below are used only for modeling and budgeting.
            </p>
            <p className="text-xs text-[#7C8894] mt-2 italic">
              Joule estimates and explains — it doesn't override your comfort or control your home.
            </p>
          </div>
          {/* Sticky Summary Bar - Dynamic */}
          {(() => {
            // Compute strategy from thermostat settings
            let strategy = "Constant temp";
            let setback = "Off";
            
            try {
              const thermostatSettings = JSON.parse(localStorage.getItem("thermostatSettings") || "{}");
              if (thermostatSettings.schedule?.enabled) {
                // Check if there's a sleep/away comfort setting that differs from home
                const home = thermostatSettings.comfortSettings?.home;
                const sleep = thermostatSettings.comfortSettings?.sleep;
                if (sleep && home) {
                  const hasSetback = sleep.heatSetPoint !== home.heatSetPoint || sleep.coolSetPoint !== home.coolSetPoint;
                  if (hasSetback) {
                    strategy = "Scheduled";
                    const heatDelta = home.heatSetPoint - sleep.heatSetPoint;
                    const coolDelta = sleep.coolSetPoint - home.coolSetPoint;
                    if (heatDelta > 0) {
                      setback = `${sleep.heatSetPoint}°F (night)`;
                    } else if (coolDelta > 0) {
                      setback = `${sleep.coolSetPoint}°F (night)`;
                    } else {
                      setback = "On";
                    }
                  }
                }
              }
            } catch {
              // Fallback to defaults
            }
            
            return (
              <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-xs font-medium text-slate-400 mb-2">Modeling Assumptions</div>
                <p className="text-xs text-[#7C8894] mb-2 italic">
                  These are the temperatures Joule uses when estimating costs — they may not match your actual thermostat schedule exactly.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-300">
                    Mode: <span className="font-semibold text-white">{userSettings.primarySystem === "heatPump" ? "Heat pump" : userSettings.primarySystem === "acPlusGas" ? "Central AC + gas" : userSettings.primarySystem === "gasFurnace" ? "Gas furnace" : "Unknown"}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">
                    Strategy: <span className="font-semibold text-white">{strategy}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">
                    Night setback: <span className="font-semibold text-white">{setback}</span>
                  </span>
                </div>
              </div>
            );
          })()}
          <ThermostatSettingsPanel />
          <div className="mt-6">
            <AutoSettingsMathEquations />
          </div>
        </div>
        )}
      </div>
      )}

      {/* Section 5: Bridge & AI */}
      {(!sectionFromRoute || sectionFromRoute === "bridge-ai") && (
      <div id="bridge-ai" className="mb-12 scroll-mt-28">
        {!sectionFromRoute && (
        <div className="mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Server className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#E8EDF3] mb-1">5. Bridge & AI</h2>
                <p className="text-sm text-[#A7B0BA]">Connect hardware and configure AI features</p>
              </div>
            </div>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, "bridge-ai": !prev["bridge-ai"] }))}
              className="text-[#A7B0BA] hover:text-white transition-colors"
            >
              {expandedSections["bridge-ai"] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
          </div>
        </div>
        )}
        {(expandedSections["bridge-ai"] || sectionFromRoute === "bridge-ai") && (
          <div className="space-y-6">
            <Section title="Joule Bridge (Local HomeKit)" icon={<ThermometerSun size={20} />} id="joule-bridge">
              <JouleBridgeSettings />
            </Section>
            <Section title="AI Integration" icon={<Zap size={20} />} id="ai-integration">
              <GroqApiKeyInput />
            </Section>
            <Section title="Pro Access" icon={<Crown className="w-5 h-5 text-amber-500" />}>
              <ProCodeInput />
            </Section>
          </div>
        )}
      </div>
      )}

      {/* Advanced Settings Section - Always show */}
      <div className="bg-[#0C1118] border border-slate-800 rounded-xl" data-advanced-settings>
        <button
          onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
          aria-expanded={advancedSettingsExpanded}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-[18px] font-medium text-[#E8EDF3]">
              Advanced Settings
            </h2>
          </div>
          <ChevronRight
            className={`text-slate-400 transition-transform ${
              advancedSettingsExpanded ? "rotate-90" : ""
            }`}
          />
        </button>

        {advancedSettingsExpanded && (
          <div className="p-6 border-t border-slate-800 space-y-6">
            <Section title="Joule Bridge URL" icon={<Server size={20} />}>
              <BridgeUrlConfig />
            </Section>

            <ZoneManagementSection setToast={setToast} />

            <Section title="Voice Settings" icon={<Mic size={20} />}>
              <div className="space-y-4">
                <TTSEngineToggle />
                <TTSServiceSettings />
                <VoicePicker />
                <VoiceListenDurationInput />
                <FunSafeModeToggle />
              </div>
            </Section>

            <Section title="Display Preferences" icon={<Settings size={20} />}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Unit System
                  </label>
                  <UnitSystemToggle />
                  <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed">
                    US mode: °F, kBTU/h, BTU/hr/°F, kWh. International mode: °C, kW, W/K, Joules (with kWh in parentheses).
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!userSettings.nerdMode}
                      onChange={(e) =>
                        setUserSetting("nerdMode", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nerd Mode (Joule / SI Units)
                    </span>
                  </label>
                  <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed ml-6">
                    Show energy values in Joules (MJ/GJ) with kWh in parentheses. Perfect for impressing engineers and physicists on Reddit. Joule stores all energy internally in Joules, then formats for display.
                  </p>
                </div>
              </div>
            </Section>

            {/* Detailed Annual Estimate Toggle */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#E8EDF3]">
                    Detailed Annual Estimate
                  </p>
                  <p className="text-xs text-[#A7B0BA] mt-1">
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

            {/* Data Management & Privacy Section */}
            <Section title="Data Management & Privacy" icon={<Shield size={20} />}>
              <div className="space-y-4">
                {/* Storage Usage Indicator */}
                <StorageUsageIndicator />
                
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2 flex items-center gap-2">
                    <Trash2 size={18} />
                    Delete All Data
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                    This will permanently delete all stored data including:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-400 mb-4 space-y-1 list-disc list-inside">
                    <li>All CSV analysis results and history</li>
                    <li>All user settings and preferences</li>
                    <li>All zone configurations</li>
                    <li>All thermostat data and diagnostics</li>
                    <li>All saved analyses and labels</li>
                    <li>Location data and preferences</li>
                    <li>Voice settings and AI preferences</li>
                  </ul>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-4">
                    ⚠️ This action cannot be undone!
                  </p>
                  <DeleteAllDataButton setToast={setToast} />
                </div>
              </div>
            </Section>
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
export { GroqApiKeyInput };